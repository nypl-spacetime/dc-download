# dc-download

Command-line tool for downloading images from [NYPL's Digital Collections](https://digitalcollections.nypl.org/).

## Installation

    npm install -g @nypl/dc-download

## Usage

To download all image captures in a Digital Collection item, run:

    dc-download <uuid-of-item>

Run `dc-download --help` for command-line options.

## Examples

[New York City directory, 1880/81](https://digitalcollections.nypl.org/items/12df7770-6bde-0134-5d34-00505686a51c#/):

    dc-download 4b5c40e0-317a-0134-e9c9-00505686a51c

How to find the UUID of a book in Digital Collections:

![](find-uuid.gif)
