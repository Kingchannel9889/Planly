/** Build-time choice; local builds never require a server or account session. */
export const LOCAL_ONLY = process.env.EXPO_PUBLIC_LOCAL_ONLY === 'true';
export const LOCAL_PLANNER_ID = 'device-only';
