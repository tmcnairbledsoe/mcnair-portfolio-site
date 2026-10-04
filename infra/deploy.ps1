$ErrorActionPreference = 'Stop'
foreach ($setting in @('AZURE_SUBSCRIPTION_ID', 'AZURE_RESOURCE_GROUP', 'AZURE_STATIC_WEB_APP_NAME')) {
  if (-not [Environment]::GetEnvironmentVariable($setting)) { throw "Set $setting in your local environment before provisioning." }
}
az group create --subscription $env:AZURE_SUBSCRIPTION_ID --name $env:AZURE_RESOURCE_GROUP --location eastus2 --output none
if ($LASTEXITCODE -ne 0) { throw 'Could not create/update resource group' }
az deployment group create --subscription $env:AZURE_SUBSCRIPTION_ID --resource-group $env:AZURE_RESOURCE_GROUP --name portfolio-hosting --template-file (Join-Path $PSScriptRoot 'main.bicep') --parameters siteName=$env:AZURE_STATIC_WEB_APP_NAME --output none
if ($LASTEXITCODE -ne 0) { throw 'Hosting deployment failed' }
