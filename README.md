# Stress Detection in Indian Rice Fields Using Remote Sensing and Machine Learning

# 1. Introduction
India’s rice production accounts for roughly 40 % of its total cereal output, playing a pivotal role in both domestic food security and export revenues. Drought-induced stress can sharply reduce yields, jeopardizing rural livelihoods, national GDP, and global supply chains.

# 2. Data Sources
**Remote Sensing Indices**: 
computed seven vegetation indices from MODIS imagery via Google Earth Engine (GEE):

Vegetation Health Index (VHI)
Leaf Area Index (LAI)
Enhanced Vegetation Index (EVI)
Normalized Difference Vegetation Index (NDVI)
Fraction of Photosynthetically Active Radiation (FPAR)
Normalized Difference Moisture Index (NDMI)
Diurnal Temperature Range (DTR)

**Climate Variables**: 
Sourced from the Indian Meteorological Department (IMD):

Precipitation: Seasonally aggregated totals (June–November)
Temperature: Seasonal average (June–November)

**Agrochemical and Yield Data**:
Retrieved from Kaggle’s “Crop Yield in Indian States” dataset, which includes state-level rice yields, fertilizer application rates, and pesticide usage: https://www.kaggle.com/datasets/akshatgupta7/crop-yield-in-indian-states-dataset

# 3. Methodology
The Remote_sensing_stage.js script runs on Google Earth Engine to:

Import a time series of MODIS images
Calculate the seven indices listed above
Export index time-series to Google Drive

**Data Aggregation**
Aggregate IMD daily precipitation into seasonal totals
Compute seasonal mean temperature
Align all variables (indices, climate, agrochemical) on a June–November temporal window

**Model Training and Evaluation** 
compared three Random Forest–based approaches:

1. Regressor: Predict continuous rice yield

2. Classifier: Label yield anomaly as “Stressed” (< 0) or “Not_Stressed” (> 0)

3. Cost-Sensitive Classifier: Same as (2), but with a weighted loss function to counteract class imbalance

# 4. Usage
Clone this repository.
Run the Earth Engine script (Remote_sensing_stage.js) to generate indices on GEE platform.
Download the Preprocessed IMD data and Kaggle dataset.
Execute the training notebooks in the ml_training/ directory to reproduce model comparisons and performance metrics.

# 5. Results and Further Work
Detailed performance metrics, feature importances, and stress maps are provided in the results/ folder. Future extensions may include:
Incorporating additional climate predictors (e.g., humidity, solar radiation)
Testing alternative algorithms (e.g., XGBoost, neural networks)
Expanding the temporal window to include rabi and summer seasons

