# Döngü 1'den 10'a kadar
for i in {1..10}
do
  # Instance numarasını 3 haneli yap (001, 002, ..., 010)
  printf -v INSTANCE_NUM "%03d" $i
  APP_NAME="booking-scraper-instance-${INSTANCE_NUM}"
  echo "Stopping: ${APP_NAME}"

  # Web App'i durdur
  az webapp stop --resource-group scraper1_group --name ${APP_NAME}

  echo "Stop command sent for ${APP_NAME}."
done

echo "Stop commands finished."