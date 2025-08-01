The Precipitation and temperature data originate from IMD and were initially daily values. Here, the provided data for precipitation is the aggregated values from June to November (Monsoon and Post-Monsoon period) for each year.
For temperature, the average of the same period has been provided in a gridded format across all India. 
Further, the rice anomaly dataset, which was downloaded from kaggle, provides us with seasonal rice yield, along with corresponding fertilizer and pesticides usage data. using a long-term mean, the state-wise 
rice yield anomaly for kharif season has been calculated using (yield (i) - yield(avg)) and labled in a binary format ("Stressed" for <0 and "Not_stressed" for >0).
Since the crop yield data is in a state-wise resolution, all the other layers including the remote sensing datasets and climate variables are resample into a state-wise resolution using Zonal Statistics function in Rasterio.
The final dataset is named as rice_anomaly_complete_dataset.csv, where the outputs of zonal statistics function on the variables have been merged.
Finally, this file (rice_anomaly_complete_dataset.csv) has been used for the ML modeling.
