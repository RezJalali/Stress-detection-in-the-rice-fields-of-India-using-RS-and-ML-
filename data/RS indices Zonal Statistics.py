import geopandas as gpd
import pandas as pd
import rasterio
from rasterstats import zonal_stats
import os

# --- 1. SETUP: Define file paths and parameters ---

# Input files (using your provided paths)
VECTOR_PATH = 'India_State_Boundary.shp'
RASTER_BASE_PATH = 'data/'
RASTER_FILENAMES = [
    'NDVI_kharif_2000to2020.tif', 'EVI_kharif_2000to2020.tif',
    'DTR_kharif_2000to2020.tif', 'FPAR_kharif_2000to2020.tif',
    'LAI_kharif_2000to2020.tif', 'NDMI_kharif_2000to2020.tif',
    'VHI_kharif_2000to2020.tif'
]

# Output file
OUTPUT_CSV_PATH = 'india_all_indices_zonal_stats.csv'

# Parameters
YEARS = list(range(2000, 2021))

# --- 2. DATA LOADING AND PREPARATION ---

print("Loading vector data...")
try:
    states_gdf = gpd.read_file(VECTOR_PATH)
except Exception as e:
    print(f"FATAL: Error loading shapefile: {e}")
    exit()

print(f"\nShapefile loaded. Available columns: {states_gdf.columns.tolist()}")

    
# For a reliable ID, we will create one from the GeoDataFrame's index.
# This avoids issues with inconsistent or missing ID columns like 'FID' or 'ID_1'.
states_gdf['unique_id'] = states_gdf.index

# Prepare a clean base GeoDataFrame
base_states_gdf = states_gdf[['unique_id', 'State_Name', 'geometry']].copy()
base_states_gdf = base_states_gdf.rename(columns={STATE_NAME_COL: 'state_name'})

# --- CRS Check (using the first raster as a reference) ---
# This assumes all of the rasters share the same Coordinate Reference System (CRS).
try:
    reference_raster_path = os.path.join(RASTER_BASE_PATH, RASTER_FILENAMES[0])
    with rasterio.open(reference_raster_path) as src:
        raster_crs = src.crs
    print(f"\nReference Raster CRS: {raster_crs}")
    print(f"Vector CRS: {base_states_gdf.crs}")

    if base_states_gdf.crs != raster_crs:
        print("CRS mismatch found. Reprojecting vector data to match rasters...")
        base_states_gdf = base_states_gdf.to_crs(raster_crs)
except Exception as e:
    print(f"FATAL: Could not read reference raster file '{reference_raster_path}'. Error: {e}")
    exit()
# --- 3. ZONAL STATISTICS CALCULATION (UNIFIED LOGIC) ---

all_results = [] # A list to hold the DataFrames for each index

# Loop through each raster file defined in the setup
for raster_filename in RASTER_FILENAMES:
    # Extract the index name from the filename (e.g., 'NDVI' from 'NDVI_kharif...')
    index_name = raster_filename.split('_')[0]
    full_raster_path = os.path.join(RASTER_BASE_PATH, raster_filename)
    
    # --- Dynamically set the correct year range for the current index ---
    # This is necessary due to the availability of MODIS's LAI, and FPAR products from 2002 unlike other products 
    if index_name in ['LAI', 'FPAR']:
        years_to_process = list(range(2002, 2021))
        print(f"\n📊 Processing Special Index: {index_name} (Years: 2002-2020)")
    else:
        years_to_process = list(range(2000, 2021))
        print(f"\n📊 Processing Index: {index_name} (Years: 2000-2020)")

    # Create a fresh copy of the states data for this index's results
    results_gdf = base_states_gdf.copy()

    # Loop through each band based on the correct year range for this index
    # IMPORTANT: This assumes band 1 corresponds to the first year in the range
    # (e.g., for LAI, band 1 = 2002; for NDVI, band 1 = 2000)
    for i, year in enumerate(years_to_process):
        band_num = i + 1
        print(f"  Processing Year: {year} (Band: {band_num})")
        
        try:
            stats = zonal_stats(
                results_gdf,
                full_raster_path,
                stats=['mean'],
                band=band_num,
                nodata=-9999
            )
            mean_values = [s['mean'] if s else None for s in stats]
            results_gdf[year] = mean_values
        except Exception as e:
            print(f"    Could not process {year} for {index_name}. Error: {e}. Skipping.")
            results_gdf[year] = None

    # --- Reshape data for the current index ---
    results_df_wide = results_gdf.drop(columns='geometry')
    
    df_long = pd.melt(
        results_df_wide,
        id_vars=['unique_id', 'state_name'],
        value_vars=years_to_process, # Melt using the correct year range
        var_name='year',
        value_name='rasterValue'
    )
    df_long['index_name'] = index_name
    
    all_results.append(df_long)

print("\n All indices processed successfully.")

# --- 4. FINAL DATA CONSOLIDATION AND EXPORT ---

print("\n Consolidating all results and saving to CSV...")

# Concatenate all the individual DataFrames into one
final_df = pd.concat(all_results, ignore_index=True)

# Reorder columns for final output
final_df = final_df[['unique_id', 'state_name', 'index_name', 'year', 'rasterValue']]

# Sort the results for better readability and consistency
final_df = final_df.sort_values(by=['state_name', 'index_name', 'year']).reset_index(drop=True)

# Save the final DataFrame to a single CSV file
final_df.to_csv(OUTPUT_CSV_PATH, index=False)

print(f"\n Success! All results have been saved to: {os.path.abspath(OUTPUT_CSV_PATH)}")
print("\nFinal Data Preview:")
print(final_df.head())
