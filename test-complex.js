const MoqServer = require('./src/index');

const server = new MoqServer({ proxy: false, noReload: true });
server.mockFilesSet = new Set(['GET-/api/users/complex match/:id.json']);
server.dynamicRoutes = [
    { method: 'GET', file: 'GET-/api/users/complex match/:id.json', parts: ['api', 'users', 'complex match', ':id'] }
];
server.mocksDir = './mocks';

server.resolveMockPathFixed = function(method, route) {
    let decodedRoute = route;
    try {
      decodedRoute = decodeURIComponent(route);
      if (decodedRoute.includes('%')) {
        try {
          decodedRoute = decodeURIComponent(decodedRoute);
        } catch (e) {
        }
      }
    } catch (e) {
      return null;
    }

    if (decodedRoute.includes('..')) {
      return null;
    }

    route = route.replace(/\/+$/, '');
    decodedRoute = decodedRoute.replace(/\/+$/, '');

    const cacheKey = `${method}:${route}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }

    if (this.routeCache.size > 10000) {
      this.routeCache.clear();
    }

    // this.getMockFiles(); // Skip for test
    const exactMatchPath = `${method}-${decodedRoute}.json`;

    if (this.mockFilesSet.has(exactMatchPath)) {
      const p = require('path').join(this.mocksDir, exactMatchPath);
      this.routeCache.set(cacheKey, p);
      return p;
    }

    // Try dynamic
    // Use the original route to split so that encoded slashes (%2F) don't alter the part count,
    // then decode the part before comparing to support decoded matches.
    const parts = route.replace(/^\//, "").split('/'); // Need to strip leading slash otherwise first part is empty and parts.length mismatch

    for (const candidate of this.dynamicRoutes) {
      if (candidate.method === method && candidate.parts.length === parts.length) {
        let match = true;
        for (let i = 0; i < candidate.parts.length; i++) {
          if (candidate.parts[i].startsWith(':') && candidate.parts[i].length > 1) continue;
          let decodedPart = parts[i];
          try {
            decodedPart = decodeURIComponent(parts[i]);
            if (decodedPart.includes('%')) {
              try { decodedPart = decodeURIComponent(decodedPart); } catch (e) {}
            }
          } catch (e) {}

          if (candidate.parts[i] !== decodedPart) {
            match = false;
            break;
          }
        }
        if (match) {
          const p = require('path').join(this.mocksDir, candidate.file);
          this.routeCache.set(cacheKey, p);
          return p;
        }
      }
    }

    return null;
};
console.log(server.resolveMockPathFixed('GET', '/api/users/complex%20match/John%2FSmith'));
