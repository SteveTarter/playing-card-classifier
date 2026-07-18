// AuthHelper.js - Cognito Authentication Helper
// eslint-disable-next-line no-unused-vars
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || "us-east-1_URgbtAzM8";
const CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID || "1svb9fjsqu862g55rca0q21vat";
const REGION = process.env.REACT_APP_COGNITO_REGION || "us-east-1";

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthHelper = {
  async signIn(username, password) {
    const url = `https://cognito-idp.${REGION}.amazonaws.com/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Authentication failed');
    }

    const data = await response.json();
    const idToken = data.AuthenticationResult.IdToken;
    const claims = decodeJwt(idToken);
    
    // Check if user is in 'superuser' group
    const groups = claims ? (claims['cognito:groups'] || []) : [];
    const isSuperuser = Array.isArray(groups) 
      ? groups.includes('superuser') 
      : groups.split(',').includes('superuser');

    if (!isSuperuser) {
      throw new Error('Access denied: You must be a member of the superuser group.');
    }

    // Save tokens and info
    localStorage.setItem('card_classifier_id_token', idToken);
    localStorage.setItem('card_classifier_email', claims.email || username);
    localStorage.setItem('card_classifier_username', claims['cognito:username'] || username);
    
    return claims;
  },

  signOut() {
    localStorage.removeItem('card_classifier_id_token');
    localStorage.removeItem('card_classifier_email');
    localStorage.removeItem('card_classifier_username');
  },

  getIdToken() {
    return localStorage.getItem('card_classifier_id_token');
  },

  getUserEmail() {
    return localStorage.getItem('card_classifier_email');
  },

  getUserName() {
    return localStorage.getItem('card_classifier_username');
  },

  isAuthenticated() {
    const token = this.getIdToken();
    if (!token) return false;
    
    const claims = decodeJwt(token);
    if (!claims) return false;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      this.signOut();
      return false;
    }
    
    return true;
  }
};
