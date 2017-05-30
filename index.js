#!/usr/bin/env node

const argvOptions = {
  alias: {
    h: 'help',
    s: 'size',
    t: 'token',
    u: 'uuids',
    o: 'output'
  },
  default: {
    s: 'q',
    o: './',
    u: 'false'
  },
  boolean: [
    'help',
    'uuids'
  ]
}

const argv = require('minimist')(process.argv.slice(2), argvOptions)
const path = require('path')
const fs = require('fs')
const H = require('highland')
const got = require('got')
const digitalCollections = require('digital-collections')

const sizes = [
  {
    type: 'b',
    description: 'Center cropped thumbnail .jpeg (100x100 pixels)',
    extension: 'jpeg',
    pdOnly: false
  },
  {
    type: 'f',
    description: 'Cropped .jpeg (140 pixels tall with variable width)',
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

let showHelp = false

if (argv._.length !== 1) {
  showHelp = true
}

if (argv.help) {
  showHelp = true
}

if (!sizes.map((size) => size.type).includes(argv.size)) {
  showHelp = true
}

if (showHelp) {
  const help = [
    'NYPL Digital Collections Image Downloader - see https://github.com/nypl-spacetime/dc-download',
    '',
    'Usage: dc-download [-h] [-n] [-t <api-token>] [-o <path>] [-s <size>] <uuid-of-item>',
    '  -t, --token     API access token (or set $DIGITAL_COLLECTIONS_TOKEN), see http://api.repo.nypl.org/',
    '  -s, --size      size/type of images to be downloaded - see below',
    '  -u, --uuids     use UUIDs of captures for filenames (instead of page number)',
    '  -o, --output    output directory, default is current directory',
    '',
    'Possible image sizes and types:',
    ...sizes.map((size) => `  ${size.type}    ${size.description}${size.pdOnly ? '*' : ''}`),
    'Sizes with * exist only for public domain assets',
    '',
    'Go to http://digitalcollections.nypl.org/ to browse NYPL\'s Digital Collections'
  ]

  console.log(help.join('\n'))
  process.exit(0)
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
  uuid: '4b00bf60-317a-0134-32d0-00505686a51c'
}

let count = 0
H(digitalCollections.captures(options))
  .map((capture) => {
    const uuid = capture.uuid
    const imageId = capture.imageID
    const parts = capture.sortString.split('|')
    const page = parseInt(parts[parts.length - 1])

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

    let filename
    if (argv.uuids) {
      filename = uuid
    } else {
      filename = page
    }

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
