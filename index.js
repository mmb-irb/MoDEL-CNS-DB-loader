#!/usr/bin/env node

// Allow reading local files
const fs = require('fs');
// Allow reading to the current working directory
const process = require('process');
// These 2 lines alone allow all scripts to access the env file through process.env
const dotenvLoad = require('dotenv').config({ path: __dirname + '/.env' });
if (dotenvLoad.error) throw dotenvLoad.error;

// "yargs" is a library used to manage script calls from unix console
const yargs = require('yargs');
// ObjectId return
const { ObjectId } = require('mongodb');

// Hanlde the setup before any command is run
const commonHandler = require('./src/commands');
// Convert a local path into a "fs" library valid global path
const resolvePath = require('./src/utils/resolve-path');

// -----------------------------------------------------------------------------------------

// Convert the input local file or folder path into a "fs" library valid global path
const fileOrFolderCoerce = fileOrFolder => {
  // Path conversion
  const cleanedUpPath = resolvePath(fileOrFolder, true);
  try {
    // Check if file or folder is accessible and executable. "X_OK" means folder must be executable.
    fs.accessSync(cleanedUpPath, fs.constants.X_OK); // UN FOLDER ES EJECUTABLE ??
  } catch (_) {
    throw new Error(`unable to use file/folder '${fileOrFolder}'`);
  }
  return cleanedUpPath;
};

// Save the object from mongo which is associated to the provided id
// WARNING: If the argument passed to this function is null a new ObjectId is generated
const idCoerce = id => ObjectId(id);

// RegExp formula to check if a string is in accession format
//const accessionFormat = /^MCNS\d{5}$/;
const accessionFormat = new RegExp(
  '^' + process.env.ACCESSION_PREFIX + '\\d{5}$',
);

// Convert the input accession string into a valid accession format
const accessionCoerce = accession => {
  // Remove spaces from the accession argument and make all characters upper case
  const output = accession.trim().toUpperCase();
  // Check if the new accession (output) is a valid accession format. If not, send an error
  if (!accessionFormat.test(output)) throw new Error('Not a valid accession');
  return output;
};

// Try to coerce the input argument as a mongo id
// If fails, try it as an accession
const idOrAccessionCoerce = idOrAccession => {
  let output;
  // This is to prevent idCoerce() to generate a new ObjectId if the passed argument is null
  if (!idOrAccession) return null;
  try {
    output = idCoerce(idOrAccession);
  } catch (_) {
    try {
      output = accessionCoerce(idOrAccession);
    } catch (_) {
      /**/
    }
  }
  if (output) return output;
  throw new Error('Invalid ID or accession');
};

// Execute different functions and scripts according to the input commands and options
// Display help info when this script is called with no commands or with a "--help" commands
// yargs API: https://github.com/yargs/yargs/blob/HEAD/docs/api.md
yargs
  // load
  .command({
    command: 'load <fileOrFolder>', // Command name. Useful for the help
    desc: 'load data from specified file or folder', // Command description. Useful for the help
    builder: yargs =>
      yargs
        // All values from options and positionals are saved at the "argv" object (explained below)
        // The order of declaration in these options and positionals is important (exemplified below)
        // --gromacs-path
        .option('gro', {
          alias: 'gromacs-path', // Option name. Useful for the help
          default: null,
          description: 'path to gromacs command-line tool', // Option description. Useful for the help
          type: 'string',
        })
        // --skip-chains
        .option('sc', {
          alias: 'skip-chains',
          default: false,
          description:
            'Skip the InterProScan analysis for protein chain function',
          type: 'boolean',
        })
        // --skip-metadata
        .option('sm', {
          alias: 'skip-metadata',
          default: false,
          description: 'Skip the metadata load (metadata.json)',
          type: 'boolean',
        })
        // --skip-trajectories
        .option('st', {
          alias: 'skip-trajectories',
          default: false,
          description:
            'Skip the load of any trajectory file (xtc) in the binary format (bin)',
          type: 'boolean',
        })
        // --skip-files
        .option('sf', {
          alias: 'skip-files',
          default: false,
          description: 'Skip the load of any file (pdb, xtc, ...)',
          type: 'boolean',
        })
        // --skip-analyses
        .option('sa', {
          alias: 'skip-analyses',
          default: false,
          description: 'Skip the load of any analyses (md.whatever.json files)',
          type: 'boolean',
        })
        // --append
        .option('a', {
          alias: 'append',
          default: null,
          description: 'Append new data to an existing project',
          type: 'string',
          coerce: idOrAccessionCoerce,
        })
        // --conserve
        .option('c', {
          alias: 'conserve',
          default: false,
          description:
            'Restrict the data append so the user is never asked and new data is loaded only when there is no conflict',
          type: 'boolean',
        })
        // --overwrite
        .option('o', {
          alias: 'overwrite',
          default: false,
          description:
            'Priorize the data append so the user is never asked and current data is overwritten when there is any conflict',
          type: 'boolean',
        })
        // --md-directories
        .option('mdir', {
          alias: 'md-directories',
          default: null,
          description: 'Set which MD directories are to be loaded'
        })
        // file or folder
        .positional('fileOrFolder', {
          describe: 'Single file to be loaded or folder containing a project to load',
          type: 'string',
          coerce: fileOrFolderCoerce, // Apply this function over the parsed value from the command line
        }),
    handler: commonHandler('load'), // Call the command script with the command name as argument
  })
  // publish
  .command({
    command: 'publish <id>',
    desc:
      'publish and assign an accession (if not already existing) to the specified id(s)',
    builder: yargs =>
      yargs
        // id
        .positional('id', {
          describe: 'ID to process',
          type: 'string',
          coerce: idCoerce,
        }),
    handler: commonHandler('publish'),
  })
  // unpublish
  .command({
    command: 'unpublish <id|accession>',
    desc:
      'publish and assign an accession to the specified id, or re-publish an existing accession',
    builder: yargs =>
      // id
      yargs.positional('id', {
        describe: 'ID or accession to unpublish',
        type: 'string',
        coerce: idOrAccessionCoerce,
      }),
    handler: commonHandler('unpublish'),
  })
  // list
  .command({
    command: 'list',
    desc: 'list all projects and their status',
    handler: commonHandler('list'),
  })
  // cleanup
  // NOTE: ask user to unpublish before cleaning up, to make them think twice
  // NOTE: about what they're about to do since there is no going back from that
  .command({
    command: 'cleanup [id]',
    aliases: ['clean', 'drop', 'clear', 'delete', 'remove'],
    desc:
      'clean-up project and related files and documents from database. To clean up a published project, you must first unpublish it',
    builder: yargs =>
      yargs
        // --delete-all-orphans
        .option('delete-all-orphans', {
          description: 'Delete all orphan documents and files',
          type: 'boolean',
        })
        // --force
        .option('f', {
          alias: 'force',
          default: false,
          description:
            'Force the data cleanup, so the user is never asked for confirmation',
          type: 'boolean',
        })
        // id
        .positional('id', {
          describe: 'ID to clean up',
          type: 'string',
          coerce: idCoerce,
        })
        .conflicts('id', 'delete-all-orphans'),
    handler: commonHandler('cleanup'),
  })
  .demandCommand() // Demand a minimmum of 1 command
  // Display all descriptions when the command --help is asked or there is no command
  .help().argv; // "argv" is a normal object passed from yargs library
// This object contains the input values of options and positionals from the command
// e.g. in load command, argv contains the values of {folder, gromacs-path}

// in case an exception manages to escape us
process.on('unhandledRejection', error => {
  console.error('Unhandled rejection');
  console.error(error);
});
