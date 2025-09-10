---
'@jetstreamgg/sky-hooks': minor
'@jetstreamgg/sky-widgets': patch
---

Add limit param to BA Labs historic endpoints

This change adds an optional `limit` parameter to the `useRewardsChartInfo` hook to control the number of data points returned from BA Labs historic endpoints. When not specified, defaults to 100. Components that only need the most recent data point now use `limit: 1` for better performance.