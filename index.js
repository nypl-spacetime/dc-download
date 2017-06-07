#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const H = require('highland')
const got = require('got')
const chalk = require('chalk')
const digitalCollections = require('digital-collections')

const argvOptions = {
  alias: {
    h: 'help',
    s: 'size',
    t: 'token',
    f: 'filename',
    o: 'output'
  },
  default: {
    s: 'q',
    o: './',
    u: 'false',
    f: 'piu'
  },
  boolean: [
    'help',
    'uuids'
  ]
}

const argv = require('minimist')(process.argv.slice(2), argvOptions)

const filenameFields = [
  {
    field: 'i',
    description: 'image ID'
  },
  {
    field: 'u',
    description: 'UUID'
  },
  {
    field: 'p',
    description: 'page number'
  }
]

const sizes = [
  {
    type: 'b',
    description: 'center cropped thumbnail .jpeg (100x100 pixels)',
    extension: 'jpeg',
    pdOnly: false
  },
  {
    type: 'f',
    description: 'cropped .jpeg (140 pixels tall with variable width)',
    extension: 'jpeg',
    pdOnly: false
  },
  {
    type: 't',
    description: 'cropped .gif (150 pixels on the long side)',
    extension: 'gif',
    pdOnly: false
  },
  {
    type: 'r',
    description: 'cropped .jpeg (300 pixels on the long side)',
    extension: 'jpeg',
    pdOnly: false
  },
  {
    type: 'w',
    description: 'cropped .jpeg (760 pixels on the long side)',
    extension: 'jpeg',
    pdOnly: false
  },
  {
    type: 'q',
    description: 'cropped .jpeg (1600 pixels on the long side)',
    extension: 'jpeg',
    default: true,
    pdOnly: true
  },
  {
    type: 'v',
    description: 'cropped .jpeg (2560 pixels on the long side)',
    extension: 'jpeg',
    pdOnly: true
  },
  {
    type: 'g',
    description: 'full-size .jpeg',
    extension: 'jpeg',
    pdOnly: true
  },
  {
    type: 'T',
    description: 'full-size .tiff',
    extension: 'tiff',
    pdOnly: true
  }
]

let errors = []
let showHelp = false

if (argv.help || argv._.length === 0) {
  showHelp = true
}

if (argv._.length > 1) {
  errors.push('Please supply no more than one item')
}

const uuid = argv._[0]

if (!sizes.map((size) => size.type).includes(argv.size)) {
  errors.push(`Image size invalid: "${argv.size}"`)
}

if (argv.filename && argv.filename.split) {
  argv.filename.split('').forEach((field) => {
    if (!filenameFields.map((field) => field.field).includes(field)) {
      errors.push(`Filename field invalid: "${field}"`)
    }
  })
}

if (!argv.filename.length) {
  errors.push(`Filename fields not specified`)
}

if (argv.filename.length > filenameFields.length) {
  errors.push(`Too many filename fields (at most ${filenameFields.length} allowed)`)
}

const defaultSize = sizes.filter((size) => size.default)[0].type

if (!argv.token && !process.env.DIGITAL_COLLECTIONS_TOKEN) {
  errors.push('Digital Collections API access token not set')
}

if (showHelp || errors.length) {
  const help = [
    'NYPL Digital Collections Image Downloader - see https://github.com/nypl-spacetime/dc-download',
    '',
    'Usage: dc-download [-h] [-t <api-token>] [-o <path>] [-f <filename>] [-s <size>] <uuid-of-item>',
    '   -t, --token      Digital Collections API access token (or set $DIGITAL_COLLECTIONS_TOKEN), see http://api.repo.nypl.org/',
    `   -s, --size       size/type of images to be downloaded - see below (default is "${defaultSize}")`,
    `   -f, --filename   fields to be used as filename for downloaded files - see below (default is "${argvOptions.default.f}")`,
    '   -o, --output     output directory (default is current directory)',
    '',
    'Possible image sizes and types:',
    ...sizes.map((size) => `    ${size.type}    ${size.description}${size.pdOnly ? '*' : ''}`),
    '            (sizes with * exist only for public domain assets)',
    '',
    'Possible filename fields:',
    ...filenameFields.map((field) => `    ${field.field}    ${field.description}`),
    '  Examples:',
    '    "piu" will yield "<pageNum>.<imageId>.<uuid>.jpeg";',
    '    "u" will yield "<uuid>.jpeg";',
    '    Et cetera!',
    '',
    'Go to http://digitalcollections.nypl.org/ to browse NYPL\'s Digital Collections',
    errors.length ? `\nErrors:\n${errors.map((error) => ' - ' + chalk.red(error)).join('\n')}\n` : null,
  ]

  console.log(help.join('\n').trim())
  process.exit(errors.length ? 1 : 0)
}

function download (url, destination, callback) {
  got.stream(url)
    .pipe(fs.createWriteStream(destination))
    .on('error', callback)
    .on('finish', callback)
}

function imageUrlsContainType (urls, size) {
  return urls.filter((url) => url.includes(`&t=${size}`))[0]
}

function imageUrl (imageId, size) {
  return `http://images.nypl.org/index.php?id=${imageId}&t=${size}`
}

const options = {
  uuid,
  token: argv.token || process.env.DIGITAL_COLLECTIONS_TOKEN
}

let count = 0
H(digitalCollections.captures(options))
  .map((capture) => {
    const uuid = capture.uuid
    const imageId = capture.imageID
    const parts = capture.sortString.split('|')
    const page = parseInt(parts[parts.length - 1])

    const fields = {
      i: imageId,
      u: uuid,
      p: page
    }

    let url
    const size = sizes.filter((size) => size.type === argv.size)[0]
    if (argv.size === 'T') {
      const tiffUrl = capture.highResLink
      if (!tiffUrl) {
        throw new Error(`TIFF not available for this capture: ${uuid}`)
      }

      url = tiffUrl
    } else {
      const jpgUrls = capture.imageLinks.imageLink

      if (!imageUrlsContainType(jpgUrls, size.type)) {
        throw new Error(`Image size '${size.type}' not available for this capture: ${uuid}`)
      }

      url = imageUrl(imageId, size.type)
    }

    const filename = argv.filename.split('').map((field) => fields[field]).join('.')

    console.log(`  Downloading image ${++count}`)

    return {
      url,
      destination: path.join(argv.output, `${filename}.${size.extension}`)
    }
  })
  .compact()
  .map((file) => H.curry(download, file.url, file.destination))
  .nfcall([])
  .series()
  .done(() => {
    console.log('Done')
  })
