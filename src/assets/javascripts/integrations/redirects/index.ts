/*
 * Copyright (c) 2025-2026 Zensical and contributors
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

import {
  Observable,
  catchError,
  combineLatestWith,
  filter,
  fromEvent,
  map,
  merge,
  of,
} from "rxjs";

import { configuration } from "~/_";
import { getLocation, requestJSON } from "~/browser";

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Redirect mappings
 */
export type Redirects = Map<string, URL>;

/* ----------------------------------------------------------------------------
 * Helper types
 * ------------------------------------------------------------------------- */

/**
 * Setup options
 */
interface SetupOptions {
  location$: Observable<URL>; // Location observable
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Fetch redirects for the given base URL
 *
 * If a network or parsing error occurs, we default to an empty redirect map,
 * so navigation continues without redirect resolution.
 *
 * @param url - Redirect manifest URL
 * @param base - Base URL
 *
 * @returns Redirect map observable
 */
export function fetchRedirects(
  url: URL | string,
  base: URL | string,
): Observable<Redirects> {
  url = new URL(url, getLocation())
  return requestJSON<Record<string, string>>(url).pipe(
    map(data => new Map(
      Object.entries(data).map(([source, target]) => [
        `${new URL(source, base)}`,
        new URL(target, base),
      ]),
    )),
    catchError(() => of(new Map())),
  );
}

/**
 * Set up redirect resolution
 *
 * @param options - Options
 */
export function setupRedirects({ location$ }: SetupOptions): void {
  const config = configuration();
  if (!config.redirect) return;

  // Resolve the manifest URL relative to the initial document, as templates
  // may emit a relative URL when the site is hosted below the domain root.
  const redirects$ = fetchRedirects(config.redirect, config.base);

  // Resolve redirects on initial load, after instant navigation and whenever
  // the fragment changes without loading a new document.
  merge(
    of(getLocation()),
    location$,
    fromEvent<HashChangeEvent>(window, "hashchange").pipe(map(getLocation)),
  )
    .pipe(
      combineLatestWith(redirects$),
      map(([source, redirects]) => {
        const url = new URL(source);

        // Redirect mappings are keyed by path and fragment, so query
        // parameters don't participate in redirect resolution.
        url.search = "";
        const target = redirects.get(`${url}`);

        // Ignore self redirects to avoid repeatedly loading the same URL.
        return target?.href !== url.href ? target : undefined;
      }),
      filter((target): target is URL => typeof target !== "undefined"),
    )
    .subscribe((target) => window.location.replace(`${target}`));
}
