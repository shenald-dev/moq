// the current loop logic is:
// while (decodedRoute.includes('%') && depth < 10) {
//   try {
//     let next = decodeURIComponent(decodedRoute);
//     if (next === decodedRoute) break;
//     decodedRoute = next;
//     depth++;
//   ...