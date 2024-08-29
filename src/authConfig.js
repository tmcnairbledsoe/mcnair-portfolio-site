// src/authConfig.js
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_AZURE_AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_AD_TENANT_ID}`,
    redirectUri: process.env.REACT_APP_REDIRECT_URI || "http://localhost:3000",
  },
  cache: {
    cacheLocation: "localStorage", // Configure this as per your security requirements
    storeAuthStateInCookie: false,
  }
};

export const loginRequest = {
  scopes: ["User.Read"], // Define the scopes you need
};

export const roleMapping = {
  OwnerRole: ["Calendar", "Journal"],
  WifeRole: ["Calendar"],
  FriendRole: []
};
