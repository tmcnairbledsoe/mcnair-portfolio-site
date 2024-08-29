import React from "react";
import { useMsal } from "@azure/msal-react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ roles, element, ...rest }) => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const userRoles = account?.idTokenClaims.roles || [];

  const hasAccess = roles.some(role => userRoles.includes(role));

  return hasAccess ? element : <Navigate to="/" />;
};

export default ProtectedRoute;
