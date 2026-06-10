# Testing Strategy

## Current Scope
The first robust test suite targets the core tracking rule:

- users are tracked inside assigned `Area` boundaries;
- positions outside an assigned geometry are marked `OUT_OF_AREA`;
- managers are scoped to their assigned areas;
- admins can access organization-wide tracking data;
- GPS payloads are validated before reaching the domain service;
- history statistics are computed from route coordinates and speeds.

## Red Green Refactor
Use this workflow for new behavior:

1. Red: write the failing test that describes the missing or broken behavior.
2. Green: implement the smallest production change that passes the test.
3. Refactor: simplify code while keeping the suite green.

The current suite intentionally mocks Prisma repositories and Socket.IO so tests do not touch Neon or Redis. Database migrations and PostGIS behavior should be covered separately with integration tests against an isolated Neon branch or a local PostGIS container.

## Commands

```bash
npm run test
npm run test:watch
npm run test:coverage
```
