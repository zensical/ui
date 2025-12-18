/*
 * Copyright (c) 2025 Zensical and contributors
 *
 * SPDX-License-Identifier: MIT
 * Third-party contributions licensed under DCO
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { minify as minhtml } from "html-minifier-terser"
import * as path from "path"
import {
  EMPTY,
  concat,
  defer,
  from,
  merge,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
  toArray,
  zip
} from "rxjs"
import { optimize } from "svgo"
import glob from "tiny-glob"

import { base, resolve, watch } from "./_"
import { copyAll } from "./copy"
import {
  transformScript,
  transformStyle
} from "./transform"

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Replace file extension
 *
 * @param file - File
 * @param extension - New extension
 *
 * @returns File with new extension
 */
function ext(file: string, extension: string): string {
  return file.replace(path.extname(file), extension)
}

/**
 * Optimize SVG data
 *
 * This function will just pass-through non-SVG data, which makes the pipeline
 * much simpler, as we can reuse it for the license texts.
 *
 * @param data - SVG data
 *
 * @returns Minified SVG data
 */
function minsvg(data: string): string {
  if (!data.startsWith("<"))
    return data

  // Optimize SVG
  const result = optimize(data, {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false
          }
        }
      },
      {
        name: "removeDimensions"
      }
    ]
  })

  // Return minified SVG
  return result.data
}

/* ----------------------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------------------- */

// Copy all assets
const assets$ = concat(

  // Copy Material Design icons
  ...["*.svg", "../LICENSE"]
    .map(pattern => copyAll(pattern, {
      from: "node_modules/@mdi/svg/svg",
      to: `${base}/.icons/material`,
      transform: async data => minsvg(data)
    })),

  // Copy GitHub octicons
  ...["*.svg", "../../LICENSE"]
    .map(pattern => copyAll(pattern, {
      from: "node_modules/@primer/octicons/build/svg",
      to: `${base}/.icons/octicons`,
      transform: async data => minsvg(data)
    })),

  // Copy FontAwesome icons
  ...["**/*.svg", "../LICENSE.txt"]
    .map(pattern => copyAll(pattern, {
      from: "node_modules/@fortawesome/fontawesome-free/svgs",
      to: `${base}/.icons/fontawesome`,
      transform: async data => minsvg(data)
    })),

  // Copy Lucide icons
  ...["**/*.svg", "../LICENSE"]
    .map(pattern => copyAll(pattern, {
      from: "node_modules/lucide-static/icons",
      to: `${base}/.icons/lucide`,
      transform: async data => minsvg(data)
    })),

  // Copy Simple icons
  ...["**/*.svg", "../LICENSE.md"]
    .map(pattern => copyAll(pattern, {
      from: "node_modules/simple-icons/icons",
      to: `${base}/.icons/simple`,
      transform: async data => minsvg(data)
    })),

  // Copy images and configurations
  ...["**/*.{jpg,png,svg,yml}"]
    .map(pattern => copyAll(pattern, {
      from: "src",
      to: base
    })),

  // Copy third-party license file
  ...["LICENSE"]
    .map(pattern => copyAll(pattern, {
      from: "src/assets/javascripts",
      to: `dist/assets/javascripts`,
      transform: async data => minsvg(data)
    })),
)

// -------------------------------------------------------------------------

// Transform styles
const stylesheets$ = resolve("**/[!_]*.scss", { cwd: "src" })
  .pipe(
    mergeMap(file => zip(
      of(ext(file, ".css")),
      transformStyle({
        from: `src/${file}`,
        to: ext(`${base}/${file}`, ".css")
      }))
    )
  )

// Transform scripts
const javascripts$ = resolve("**/{bundle,search}.ts", { cwd: "src" })
  .pipe(
    mergeMap(file => zip(
      of(ext(file, ".js")),
      transformScript({
        from: `src/${file}`,
        to: ext(`${base}/${file}`, ".js")
      }))
    )
  )

// Compute manifest
const manifest$ = merge(
  ...Object.entries({
    "**/*.scss": stylesheets$,
    "**/*.{js,ts}*": javascripts$
  })
    .map(([pattern, observable$]) => (
      defer(() => process.argv.includes("--watch")
        ? from(glob(pattern, { cwd: "src" }))
            .pipe(switchMap(files => watch(files, { cwd: "src" })))
        : EMPTY
      )
        .pipe(
          startWith("*"),
          switchMap(() => observable$.pipe(toArray()))
        )
    ))
)
  .pipe(
    scan((prev, mapping) => (
      mapping.reduce((next, [key, value]) => (
        next.set(
          key.replace("\\", "/"),
          value.replace("\\", "/").replace(`${base}/`, "")
        )
      ), prev)
    ), new Map<string, string>()),
  )

// Transform templates
const templates$ = manifest$
  .pipe(
    switchMap(manifest => copyAll("**/*.{html,xml}", {
      from: "src",
      to: base,
      watch: process.argv.includes("--watch"),
      transform: async data => {
        const banner =
          "{#-\n" +
          "  This file was automatically generated - do not edit\n" +
          "-#}\n"

        // If necessary, apply manifest
        if (process.argv.includes("--optimize"))
          for (const [key, value] of manifest)
            data = data.replace(
              new RegExp(`('|")${key}\\1`, "g"),
              `$1${value}$1`
            )

        // Normalize line feeds and minify HTML
        const html = data.replace(/\r\n/gm, "\n")
        return banner + await minhtml(html, {
          collapseBooleanAttributes: true,
          includeAutoGeneratedTags: false,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true
        })
          .then(html => html.replace(/^\s*[\r\n]/gm, ""))
      }
    }))
  )

/* ----------------------------------------------------------------------------
 * Program
 * ------------------------------------------------------------------------- */

// Assemble pipeline
const build$ =
  process.argv.includes("--dirty")
    ? merge(templates$)
    : concat(assets$, templates$)

// Let's get rolling
build$.subscribe()
