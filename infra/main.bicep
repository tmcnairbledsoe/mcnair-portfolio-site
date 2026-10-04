@description('Azure Static Web App name. Keep the existing name to update hosting in place.')
param siteName string

@description('Supported Azure Static Web Apps region.')
param location string = 'eastus2'

resource site 'Microsoft.Web/staticSites@2024-11-01' = {
  name: siteName
  location: location
  tags: {
    project: siteName
    'managed-by': 'github'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      appArtifactLocation: 'build'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output siteId string = site.id
output hostname string = site.properties.defaultHostname
