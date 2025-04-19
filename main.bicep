param location string = 'northeurope'
param appServicePlanName string = 'asp-booking-001'
param resourceGroupName string = 'scraper1_group'
param acrName string = 'scraper1registry'
param dockerImageAndTag string = 'booking-scraper:dev'
param databaseUrl string = 'prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlfa2V5IjoiNzdmMTM2NTctYWVhMC00NzI3LWE2MjctMGZiMzc4ZTg0YjhmIiwidGVuYW50X2lkIjoiMTk2OWYyZGVmMzU5ZGI0NzA4YjY0N2Q5NWJiMDMxNDVmZjhiYWFjYmEyMDI4NWE4NDNlZWFkMzczMmZlY2M3OCIsImludGVybmFsX3NlY3JldCI6IjM0Y2U0MjRjLWRlMGUtNGJhZS1hMzhkLWUyMjNhYjM2NTZhMCJ9.Fe5rqB2bjGQe7Z-Zf4Rx08lic_v-zgiqJSFCOYPFKYE'
param numberOfInstancesToCreate int = 9
param appNamePrefix string = 'booking-scraper-instance'
param startIndex int = 2 // Start naming from 002
param totalApps int = 10
param defaultTimeout string = '180000'

// Reference the existing App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' existing = {
  name: appServicePlanName
  scope: resourceGroup(resourceGroupName) // Ensure correct scope if plan is in a different RG
}

// Loop to create multiple App Service instances (002 to 010)
resource appService 'Microsoft.Web/sites@2022-09-01' = [for i in range(0, numberOfInstancesToCreate): {
  name: '${appNamePrefix}-${padLeft(i + startIndex, 3, '0')}' // e.g., booking-scraper-instance-002
  location: location
  identity: {
    type: 'SystemAssigned' // Enable System-assigned Managed Identity for ACR access
  }
  properties: {
    serverFarmId: appServicePlan.id // Link to the existing App Service Plan
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrName}.azurecr.io/${dockerImageAndTag}'
      appSettings: [
        {
          name: 'DATABASE_URL'
          value: databaseUrl
        }
        {
          name: 'APP_INDEX'
          value: string(i + startIndex - 1) // Index 1 to 9 (since loop is 0-8 and startIndex is 2)
        }
        {
          name: 'TOTAL_APPS'
          value: string(totalApps)
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrName}.azurecr.io'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false' // Common setting for Docker deployments
        }
        {
          name: 'TIMEOUT'
          value: defaultTimeout
        }
        {
          name: 'NODE_ENV'
          value: 'production' // Align with Dockerfile ENV
        }
        {
          name: 'DISABLE_IMAGES'
          value: 'true' // Added from instance 001 config
        }
        {
          name: 'HEADLESS'
          value: 'true' // Added from instance 001 config
        }
        {
          name: 'USER_AGENT'
          value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36' // Added generic Chrome UA, replace if specific one needed
        }
        // Add other required environment variables here
        // {
        //   name: 'DISABLE_IMAGES'
        //   value: 'true'
        // },
        // {
        //   name: 'USER_AGENT'
        //   value: 'Your User Agent'
        // }
      ]
    }
  }
}] 
