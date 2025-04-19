# Döngü 1'den 10'a kadar
for i in {1..10}
do
  # Instance numarasını 3 haneli yap (001, 002, ..., 010)
  printf -v INSTANCE_NUM "%03d" $i
  APP_NAME="booking-scraper-instance-${INSTANCE_NUM}"
  echo "Starting: ${APP_NAME}"

  # Web App'i başlat
  az webapp start --resource-group scraper1_group --name ${APP_NAME}

  echo "Start command sent for ${APP_NAME}."
done

echo "Start commands finished."