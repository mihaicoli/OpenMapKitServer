var _ = require('lodash')
var aggregateOsm = require('../osm/aggregate-osm-to-geojson');
var getOsmSubmissionsDirs = require('../helpers/get-osm-submissions-dirs');
var osmtogeojson = require('osmtogeojson');
var DOMParser = require("xmldom").DOMParser;
/**
 * Aggregates together all of the OSM submissions
 * from ODK Collect / OpenMapKit Android to the
 * file system for the given form.
 */
module.exports = function(req, res, next) {
  var formName = req.params.formName;
  var filters = {
    deviceId: req.query.deviceId,
    username: req.query.username,
    startDate: req.query.start_date,
    endDate: req.query.end_date,
    offset: req.query.offset,
    limit: req.query.limit
  };

  getOsmSubmissionsDirs(formName, {
    filters: filters
  }, function(err, osmDirs) {
    if (err) {
      res.status(err.status || 500).json(err);
      return;
    }
    aggregate(osmDirs, req, res);
  });
};

/**
 * Calls aggregate-osm middleware to read OSM edit files
 * and concatenate into a single OSM XML aggregation.
 *
 * @param osmDirs  - submission dirs with array of osm files
 * @param req       - the http request
 * @param res       - the http response
 */
function aggregate(osmDirs, req, res) {
  var osmFiles = [];
  for (var i in osmDirs) {
    osmFiles = osmFiles.concat(osmDirs[i].files);
  }
  if (req.query.offset != null) {
    var offset = parseInt(req.query.offset);
    var limit = parseInt(req.query.limit);
    osmFiles = osmFiles.slice(offset, offset + limit);
  }
  //We filter by the query parameters of the request
  aggregateOsm(osmFiles, req.query, function(err, osmXml) {
    if (err) {
      if (!res._headerSent) { // prevents trying to send multiple error responses on a single request
        res.status(500).json({
          status: 500,
          msg: 'There was a problem with aggregating OSM JOSM editor files in the submissions directory.',
          err: err
        });
      }
      return;
    }
    var xmlObj = (new DOMParser()).parseFromString(osmXml, 'text/xml');
    var geojson = osmtogeojson(xmlObj);
    var csv = '';

    // add headers (list all properties keys of the geojson file)
    var properties = geojson.features.reduce(
      (props, item) =>
        props.concat(
          Object.keys(item.properties).filter(i => props.indexOf(i) === -1)
        ),
      []
    );

    _.each(properties, function(property) {
      csv += `${property},`;
    });
    csv += '\n';

    // add data (if a feature has not a property, add a empty space)
    _.each(geojson.features, function(feature){
      _.each(properties, function(key, i) {
        let value = feature.properties[key] ? feature.properties[key] : ' ';
        csv += `"${value}",`;
      });
      csv += '\n';
    });

    res.status(200)
      .set('Content-Type', 'text/csv')
      .send(csv);
  });
}
