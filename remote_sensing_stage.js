
// --- 1. Define Analysis Parameters ---
var startYear = 2000;
var endYear = 2020;
var startMonth = 6; // June
var endMonth = 11; // November

var startDate = ee.Date.fromYMD(startYear, 1, 1);
var endDate = ee.Date.fromYMD(endYear, 12, 31);

// List of years to iterate over for yearly composites.
var years = ee.List.sequence(startYear, endYear);

// --- 2. LOAD & PRE-PROCESS ALL MODIS COLLECTIONS FOR THE ENTIRE PERIOD ---

// a) Vegetation Indices from MOD13A1 (16-Day, 500m)
var viCollection = ee.ImageCollection('MODIS/061/MOD13A1')
                    .filterDate(startDate, endDate)
                    .filterBounds(indiaROI);

// b) Land Surface Temperature from MOD11A2 (8-Day, 1km)
var lstCollection = ee.ImageCollection('MODIS/061/MOD11A2')
                    .filterDate(startDate, endDate)
                    .filterBounds(indiaROI);

// // c) Daily Temperature from MOD11A1 (Daily, 1km) for DTR
// var dtrCollectionDaily = ee.ImageCollection('MODIS/061/MOD11A1')
//                           .filterDate(startDate, endDate)
//                           .filterBounds(indiaROI);

// d) LAI & FPAR from MCD15A3H (4-Day, 500m)
var laiFparCollection = ee.ImageCollection('MODIS/061/MCD15A3H')
                          .filterDate(startDate, endDate)
                          .filterBounds(indiaROI);

// e) Surface Reflectance from MOD09A1 (8-Day, 500m) for NMDI
var reflectanceCollection = ee.ImageCollection('MODIS/061/MOD09A1')
                              .filterDate(startDate, endDate)
                              .filterBounds(indiaROI);

// --- 3. HELPER FUNCTIONS FOR MASKING AND CALCULATIONS ---

var maskMod13 = function(image) {
  var qa = image.select('SummaryQA');
  // Keep good data (SummaryQA bits 0-1 are 0)
  var mask = qa.bitwiseAnd(3).eq(0);
  return image.updateMask(mask).multiply(0.0001)
              .copyProperties(image, ['system:time_start']);
};

var maskMod11 = function(image) {
  var qa = image.select('QC_Day');
  // Keep good data (QC_Day bits 0-1 are 0)
  var mask = qa.bitwiseAnd(3).eq(0);
  return image.updateMask(mask)
              .select(['LST_Day_1km', 'LST_Night_1km'])
              .multiply(0.02).subtract(273.15) // Convert K to Celsius
              .copyProperties(image, ['system:time_start']);
};

var maskMcd15 = function(image) {
  var qa = image.select('FparLai_QC');
  // Keep good data (FparLai_QC bit 0 is 0)
  var mask = qa.bitwiseAnd(1).eq(0);
  return image.updateMask(mask).select(['Lai', 'Fpar'])
              .multiply([0.1, 0.01]) // Apply scale factors
              .copyProperties(image, ['system:time_start']);
};

var maskMod09 = function(image) {
  var qa = image.select('StateQA');
  // Keep good data (StateQA bit 0 is 0)
  var mask = qa.bitwiseAnd(1).eq(0);
  return image.updateMask(mask)
              .select(['sur_refl_b02', 'sur_refl_b06', 'sur_refl_b07'])
              .multiply(0.0001)
              .copyProperties(image, ['system:time_start']);

// Apply masking and scaling to the full collections
var viScaled = viCollection.map(maskMod13);
var lstScaled = lstCollection.map(maskMod11);
var laiFparScaled = laiFparCollection.map(maskMcd15);
var reflectanceScaled = reflectanceCollection.map(maskMod09);
// Print resulted collections to check the count of image elements
print(viScaled,'viScaled');
print(lstScaled,'lstScaled');
print(laiFparScaled,'laiFparScaled');
print(reflectanceScaled,'reflectanceScaled');

// --- 4. CREATE YEARLY MEAN COMPOSITES (JUNE-November) ---

// This function will be mapped over the list of years.
var createYearlyMean = function(collection, bandName) {
  return ee.ImageCollection.fromImages(
    years.map(function(y) {
      var year = ee.Number(y);
      // Filter the collection for the specific year and months
      var yearlyCollection = collection.filter(ee.Filter.calendarRange(year, year, 'year'))
                                       .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'));
      
      // Calculate the mean for that period and set the timestamp
      return yearlyCollection.select(bandName).mean().clip(indiaROI)
                             .set('year', year)
                             .set('system:time_start', ee.Date.fromYMD(year, startMonth, 1));
    })
  );
};

// a) NDVI Yearly Mean Collection
var ndviYearlyMean = createYearlyMean(viScaled, 'NDVI');

// b) EVI Yearly Mean Collection
var eviYearlyMean = createYearlyMean(viScaled, 'EVI');

// c) LAI Yearly Mean Collection
var laiYearlyMean = createYearlyMean(laiFparScaled.select('Lai'), 'Lai');

// d) FPAR Yearly Mean Collection
var fparYearlyMean = createYearlyMean(laiFparScaled.select('Fpar'), 'Fpar');

// e) DTR (Diurnal Temperature Range) Yearly Mean Collection
// The entire process is handled year-by-year to be efficient and avoid element limits in GEE.
// formula : T(max) - T(min)
var dtrYearlyMean = ee.ImageCollection.fromImages(
  years.map(function(y) {
    var year = ee.Number(y);

    // 1. Load and filter the daily data for ONLY one year and the ROI.
    // This is efficient and avoids query limits.
    var yearlyCollection = ee.ImageCollection('MODIS/061/MOD11A1')
      .filterBounds(indiaROI) // Filter by bounds here on the small yearly set
      .filter(ee.Filter.calendarRange(year, year, 'year'))
      .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'));

    // 2. Map over this small collection to calculate daily DTR.
    var dailyDtr = yearlyCollection.map(function(image) {
      // Select bands and apply scaling in one step.
      // This returns a scaled two-band image.
      var scaledImage = image.select(['LST_Day_1km', 'LST_Night_1km'])
                        .multiply(0.02)
                        .subtract(273.15); // Converts from scaled Kelvin to Celsius

      // Calculate DTR directly from the scaled two-band image.
      return scaledImage.select('LST_Day_1km')
                   .subtract(scaledImage.select('LST_Night_1km'))
                   .rename('DTR');
    });

    // 3. Calculate the mean of all daily DTR values for the period.
    // Clip the final mean image once, which is more efficient.
    return dailyDtr.mean()
      .clip(indiaROI)
      .set('year', year)
      .set('system:time_start', ee.Date.fromYMD(year, startMonth, 1));
  })
);

// f) NMDI (Normalized Multi-band Drought Index) Yearly Mean Collection
// First, calculate NMDI for each image, then find the yearly mean.
var nmdiJuneNov = reflectanceScaled.filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
  .map(function(image) {
    var nmdi = image.expression(
      '(NIR - (SWIR1 - SWIR2)) / (NIR + (SWIR1 - SWIR2))', {
        'NIR': image.select('sur_refl_b02'), 'SWIR1': image.select('sur_refl_b06'), 'SWIR2': image.select('sur_refl_b07')
      }).rename('NMDI');
    return image.addBands(nmdi).select('NMDI');
  });
var nmdiYearlyMean = createYearlyMean(nmdiJuneNov, 'NMDI');


// g) VHI (Vegetation Health Index) Yearly Mean Collection
// VHI must be calculated for each time-step first, THEN averaged annually.
// formula : VHI=a*VCI + (1- a)*TCI
// VCI=(NDVI(i) - NDVI(min))/ (NDVI(max) - NDVI(min))
// TCI = (LST max − LST(i))/ (LST max − LST min) × 100
var calculateVhi = function(viFull, lstFull) {
  var ndviMin = viFull.select('NDVI').min();
  var ndviMax = viFull.select('NDVI').max();
  var lstMin = lstFull.select('LST_Day_1km').min();
  var lstMax = lstFull.select('LST_Day_1km').max();
  var ndviRange = ndviMax.subtract(ndviMin);
  var lstRange = lstMax.subtract(lstMin);
  var validMask = ndviRange.gt(0).and(lstRange.gt(0));
  
  var viJuneNov = viFull.filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'));
  var lstJuneNov = lstFull.filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'));

  var timeFilter = ee.Filter.maxDifference({difference: 8 * 24 * 60 * 60 * 1000, leftField: 'system:time_start', rightField: 'system:time_start'});
  var joinedCollection = ee.Join.inner().apply(viJuneNov, lstJuneNov, timeFilter);

  var mergedCollection = joinedCollection.map(function(f) { return ee.Image(f.get('primary')).addBands(ee.Image(f.get('secondary'))); });
  
  var vhiTs = ee.ImageCollection(mergedCollection).map(function(image) {
    var vci = image.select('NDVI').subtract(ndviMin).divide(ndviRange).rename('VCI');
    var tci = lstMax.subtract(image.select('LST_Day_1km')).divide(lstRange).rename('TCI');
    var vhi = vci.multiply(0.5).add(tci.multiply(0.5)).rename('VHI');
    return vhi.updateMask(validMask).copyProperties(image, ['system:time_start']);
  });
  return vhiTs;
};
// Calculate VHI 
var vhiNative = calculateVhi(viScaled, lstScaled.select('LST_Day_1km'));
// Now calculate the yearly mean of the native VHI values
var vhiYearlyMean = createYearlyMean(vhiNative, 'VHI');


// --- 5. PRINT FINAL YEARLY MEAN COLLECTIONS ---
// Each collection now contains one image per year, representing the mean
// value for the June-November period.

print('1. NDVI Yearly Mean Collection (June-Nov)', ndviYearlyMean);
print('2. EVI Yearly Mean Collection (June-Nov)', eviYearlyMean);
print('3. LAI Yearly Mean Collection (June-Nov)', laiYearlyMean);
print('4. FPAR Yearly Mean Collection (June-Nov)', fparYearlyMean);
print('5. DTR Yearly Mean Collection (June-Nov)', dtrYearlyMean);
print('6. NMDI Yearly Mean Collection (June-Nov)', nmdiYearlyMean);
print('7. VHI Yearly Mean Collection (June-Nov)', vhiYearlyMean);

// // --- 6. EXAMPLE VISUALIZATION ---
// // You can now visualize the mean for a specific year.
// var vhi2020 = vhiYearlyMean.filter(ee.Filter.eq('year', 2020)).first();
// var vhiParams = {min: 0, max: 1, palette: ['#d73027', '#fee08b', '#1a9850']};
// Map.addLayer(vhi2020, vhiParams, 'Mean VHI for 2020 (June-Nov)');
// Map.setCenter(80, 22, 4);

var collectionToBandStack = function(collection, prefix) {
  // Map over the collection to rename the bands of each image.
  var renamedCollection = collection.map(function(image) {
    var year = ee.Number(image.get('year')).toInt(); 
    var newName = ee.String(prefix).cat('_').cat(ee.String(year));
    return image.rename(newName);
  });
  
  // Convert the collection of renamed images to a single multi-band image.
  return renamedCollection.toBands();
  

};
var NDVI_exp = collectionToBandStack(ndviYearlyMean,'NDVI');
var EVI_exp = collectionToBandStack(eviYearlyMean,'EVI');
var LAI_exp = collectionToBandStack(laiYearlyMean,'LAI');
var FPAR_exp = collectionToBandStack(fparYearlyMean,'FPAR');
var DTR_exp = collectionToBandStack(dtrYearlyMean,'DTR');
var NDMI_exp = collectionToBandStack(nmdiYearlyMean,'NDMI');
var VHI_exp = collectionToBandStack(vhiYearlyMean,'VHI');


// // Export the final image to your Google Drive with a 0.5-degree grid.

// Example of Export

Export.image.toDrive({
  image: EVI_exp,
  description: 'EVI_kharif',
  folder: 'CMA_Project',
  fileNamePrefix: 'EVI_kharif_2000to2020',
  region: indiaROI,
  // DO NOT use scale. Use crs and crsTransform instead.
  crs: 'EPSG:4326', // Use the WGS84 projection which uses degrees.
  crsTransform: [0.5, 0, 0, 0, -0.5, 0], // Defines a 0.5 x 0.5 degree grid.
  maxPixels: 1e13
});
