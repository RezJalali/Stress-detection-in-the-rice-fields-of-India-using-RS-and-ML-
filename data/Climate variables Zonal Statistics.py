import rasterio
import pandas as pd
import geopandas as gpd
from rasterstats import zonal_stats
import os

# --- 1. SETUP: Define paths and parameters ---
STATES_SHP_PATH = 'India_State_Boundary.shp'
PRECIP_FOLDER = 'Kharif_Precipitation/'
TEMP_FOLDER = 'Kharif_temperature'
OUTPUT_CSV = 'india_yearly_climate_stats.csv'
start_year = 2000
end_year = 2020

# --- 2. Load and Prepare Vector Data ---
print(">> Loading and preparing states shapefile <<")
# Load the shapefile
states_gdf = gpd.read_file(STATES_SHP_PATH)

# Reproject to match raster CRS (WGS84)
base_states_gdf = states_gdf.to_crs("EPSG:4326")
base_states_gdf['id'] = base_states_gdf.index

# --- 3. Process Data Year by Year ---
all_results = []
print(">> Starting zonal statistics calculation <<")
for year in range(start_year, end_year + 1):
    print(f"  > Processing year: {year}")

    precip_raster_path = os.path.join(PRECIP_FOLDER, f'precip_{year}.tif')
    temp_raster_path = os.path.join(TEMP_FOLDER, f'temp_{year}.tif')

    if not os.path.exists(precip_raster_path) or not os.path.exists(temp_raster_path):
        print(f"    - WARNING: Raster not found for year {year}. Skipping.")
        continue

    # --- 4. Calculate Zonal Statistics with all_touched=True ---
    try:
        # Open each raster to get its specific NoData value
        with rasterio.open(precip_raster_path) as src:
            precip_nodata = src.nodata
        with rasterio.open(temp_raster_path) as src:
            temp_nodata = src.nodata

        # Calculate for Precipitation
        precip_stats = zonal_stats(base_states_gdf,
                                   precip_raster_path,
                                   stats="mean",
                                   geojson_out=True,
                                   all_touched=True,
                                   nodata=precip_nodata)

        # Calculate for Temperature
        temp_stats = zonal_stats(base_states_gdf,
                                 temp_raster_path,
                                 stats="mean",
                                 geojson_out=True,
                                 all_touched=True,
                                 nodata=temp_nodata)

    except Exception as e:
        print(f"    - ERROR calculating stats for year {year}: {e}")
        continue

    # --- 5. Extract and Store Results ---
    for i in range(len(base_states_gdf)):
        p_mean = precip_stats[i]['properties'].get('mean')
        t_mean = temp_stats[i]['properties'].get('mean')
        
        state_name = precip_stats[i]['properties']['State_Name']
        state_id = precip_stats[i]['properties']['id']

        all_results.append({
            'id': state_id,
            'state_name': state_name,
            'year': year,
            'Precipitation_val': p_mean,
            'Temperature_val': t_mean
        })

# --- 6. Create Final DataFrame and Save to CSV ---
print("Processing complete!")
results_df = pd.DataFrame(all_results)
results_df.to_csv(OUTPUT_CSV, index=False)

print(f"\n Output successfully saved to: {OUTPUT_CSV}")
print(results_df.head())
