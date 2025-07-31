# Stress-detection-in-the-rice-fields-of-India-using-RS-and-ML-

The rice fields of India contribute to approximately 40% of India's net creal prodution, and hence heavily affect the socioeconomic situation in this country. Further, rice is one of the most important goods that is exported from India to many countries around the world. A drought-induced stress and subsequently a reduction in rice production could heavily affect India's economy and the supply chain in other countries.

In this project, the goal is to train a random forrest model to predict vegetation stress in the rice fields of India during the Kharif season and the post-monsoon period (from June to November) based on remote sensing indices, climate variables, and fertilizer/pesticide usage as input variables, and rice yield anomaly as the target variable.
The remote sensing indices included are VHI, LAI, EVI, NDVI, FPAR, NDMI, and DTR, with each one capturing a different aspect of stress (and health) in vegetation.
The provided piece of code in the Remote_sensing_stage.js could be used in the Google Earth Engine (GEE) platform to call a time-series of MODIS images, calculate the indices and export the result to Drive.
Precipitation and temperature are the climate variables that has been included in this project, downloaded from the Indian Meteorological Department (IMD), which are originally available as daily values. For precipitation, a seasonal aggregation has been used during the period of June to November, while for the temperature, an average over the same period has been taken into account. 
For the rice yield data, as well as the amount of fertilizers and pesticides, I have used a dataset available on Kaggle, accessible by this link:  https://www.kaggle.com/datasets/akshatgupta7/crop-yield-in-indian-states-dataset
Further, to compare different approaches in ML training stage, I have compared 3 different approaches:
1. training a random forrest regressor to predict rice yield.
2. training a random forrest classifier to predict rice yield anomaly (with values <0 labeled as "Stressed" and values >0 as "Not_Stressed".
3. training the same random forrest classifier in option 2 with a cost-sensitive function to address the imbalanced nature of the data.


