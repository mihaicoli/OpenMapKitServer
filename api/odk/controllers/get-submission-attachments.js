'use strict';

const path = require('path');
const archiver = require('archiver');
const recursive = require('recursive-readdir');
const aggregate = require('../helpers/aggregate-submissions');
const settings = require('../../../settings');

/**
 * Aggregates together all attachments to survey submissions.
 */
module.exports = (req, res, next) => {
  const formName = req.params.formName;
  const submissionsDir = path.join(settings.dataDir, 'submissions', formName);
  var filterList = [];

  return recursive(submissionsDir, ['data.json', 'data.xml', '*.osm'], (err, files) => {
    if (err) {
      return res.status(500).json({
        status: 500,
        msg: 'Could not list submissions.',
        err: err
      });
    }

    res.status(200);
    // res.contentType('application/zip');
    res.contentType('application/zip');
    res.set('Content-Disposition', `attachment; filename=${formName}.zip`);

    const archive = archiver('zip');

    archive.on('close', () => {
      res.end();
    });

    archive.on('error', err => {
      console.warn(err.stack);
    });

    archive.pipe(res);

    // Aggregates all the submissions into json and creates a filtered list of IDs
    // then checks those IDs agains the file path
    aggregate({
      formName: req.params.formName,
      limit: req.query.limit,
      offset: req.query.offset,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      deviceId: req.query.deviceId,
      username: req.query.username
    }, (err, aggregate) => {
      if (err) {
        console.warn(err.stack);
        return res.status(err.status).json(err);
      }

      aggregate.forEach(function(element) {
        filterList.push(element['meta']['instanceId'].split(':')[1]);
      });
      
      files
      // includes only folders in the filterList 
      .filter(filename => {
        var fileSplit = filename.split('/');
        var fileId = fileSplit[fileSplit.length - 2];
        return filterList.indexOf(fileId) >= 0;
      })
      .forEach(filename => {
        archive.file(filename, {
          name: path.basename(filename)
        });
      });
      archive.finalize();
    });
  });
};
