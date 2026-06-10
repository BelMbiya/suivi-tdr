# Track TDR API

Toutes les réponses suivent le format :

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Les erreurs suivent le format :

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## Auth
- `POST /api/auth/login` : connexion web, pose cookies HttpOnly.
- `POST /api/auth/refresh` : rotation du refresh token.
- `POST /api/auth/logout` : révocation de session.
- `GET /api/auth/me` : utilisateur courant.

## Users
- `GET /api/users?page=1&pageSize=20&search=&areaId=&role=&isActive=` : liste paginée.
- `POST /api/users` : création utilisateur avec rôles et areas.
- `PATCH /api/users/:id` : mise à jour, activation/désactivation, rôles, areas.

## Areas
- `GET /api/areas` : zones opérationnelles.
- `POST /api/areas` : création avec boundary GeoJSON optionnel.
- `PATCH /api/areas/:id` : modification.
- `DELETE /api/areas/:id` : désactivation.

## Locations
- `GET /api/locations?areaId=` : dernières positions par utilisateur.
- `POST /api/locations` : réception position web full-online.
- `GET /api/locations/history?userId=&from=&to=&page=&pageSize=&areaId=` : historique et statistiques.

## Dashboard
- `GET /api/dashboard?areaId=` : métriques globales ou filtrées par area.

## Geofences
- `GET /api/geofences?areaId=&isActive=` : liste paginée.
- `POST /api/geofences` : création cercle ou polygone.
- `PATCH /api/geofences/:id` : modification.
- `DELETE /api/geofences/:id` : désactivation.
