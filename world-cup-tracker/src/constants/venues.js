// Venue metadata for the 16 host cities of the 2026 FIFA World Cup.
// Keyed by the "ground" / city label used in fixture data so it's easy to
// correct stadium names or host countries independently of fixture logic.
(function (global) {
  var VENUES = {
    'Atlanta': { stadium: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA' },
    'Boston (Foxborough)': { stadium: 'Gillette Stadium', city: 'Boston', country: 'USA' },
    'Dallas (Arlington)': { stadium: 'AT&T Stadium', city: 'Dallas', country: 'USA' },
    'Guadalajara (Zapopan)': { stadium: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico' },
    'Houston': { stadium: 'NRG Stadium', city: 'Houston', country: 'USA' },
    'Kansas City': { stadium: 'GEHA Field at Arrowhead Stadium', city: 'Kansas City', country: 'USA' },
    'Los Angeles (Inglewood)': { stadium: 'SoFi Stadium', city: 'Los Angeles', country: 'USA' },
    'Mexico City': { stadium: 'Estadio Banorte', city: 'Mexico City', country: 'Mexico' },
    'Miami (Miami Gardens)': { stadium: 'Hard Rock Stadium', city: 'Miami', country: 'USA' },
    'Monterrey (Guadalupe)': { stadium: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico' },
    'New York/New Jersey (East Rutherford)': { stadium: 'MetLife Stadium', city: 'New York/New Jersey', country: 'USA' },
    'Philadelphia': { stadium: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA' },
    'San Francisco Bay Area (Santa Clara)': { stadium: "Levi's Stadium", city: 'San Francisco Bay Area', country: 'USA' },
    'Seattle': { stadium: 'Lumen Field', city: 'Seattle', country: 'USA' },
    'Toronto': { stadium: 'BMO Field', city: 'Toronto', country: 'Canada' },
    'Vancouver': { stadium: 'BC Place', city: 'Vancouver', country: 'Canada' }
  };

  function lookup(ground) {
    return VENUES[ground] || { stadium: 'TBD', city: ground || 'TBD', country: 'TBD' };
  }

  global.WC = global.WC || {};
  global.WC.VENUES = VENUES;
  global.WC.venueFor = lookup;
})(window);
