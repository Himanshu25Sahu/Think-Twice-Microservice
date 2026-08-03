// utils/demoAuth.js

// The public deployment has no verified Google consent screen, so a visitor who
// clicks "Continue with Google" would hit an access-denied page rather than the
// app. Until OAuth is verified, that button signs them into the shared demo
// account instead — same destination, none of the setup.
//
// Set NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true to restore the real OAuth redirect.
export const isGoogleOAuthEnabled = () => process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH === 'true';

// Not a secret — this account is deliberately public and read-mostly. It is
// already shipped in the client bundle behind the "View live demo" button.
export const DEMO_CREDENTIALS = {
  email: process.env.NEXT_PUBLIC_DEMO_EMAIL || 'himpreetak@gmail.com',
  password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || '123456',
};
