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

import { Observable, catchError, map, of, shareReplay } from "rxjs";

import { getElement, getElements, requestXML } from "~/browser";

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Sitemap, i.e. a list of URLs
 */
export type Sitemap = Map<string, URL[]>;

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Resolve URL to the given base URL
 *
 * When serving the site with instant navigation, MkDocs will set the hostname
 * to the value as specified in `dev_addr`, but the browser allows for several
 * hostnames to be used: `localhost`, `127.0.0.1` or even `0.0.0.0`, depending
 * on configuration. This function resolves the URL to the given hostname.
 *
 * @param url - URL
 * @param base - Base URL
 *
 * @returns Resolved URL
 */
function resolve(url: URL, base: URL) {
  url.protocol = base.protocol;
  url.hostname = base.hostname;
  if (base.port) {
    url.port = base.port;
  }
  return url;
}

/**
 * Find root URL shared by all sitemap locations
 *
 * @param urls - Sitemap locations
 *
 * @returns Root URL, if the sitemap contains one
 */
function getRoot(urls: URL[]): URL | undefined {
  if (!urls.length) return;
  const root = urls.reduce((prev, next) => (
    prev.pathname.length <= next.pathname.length ? prev : next
  ));
  const path = root.pathname.endsWith("/")
    ? root.pathname
    : `${root.pathname}/`;

  return urls.every((url) => (
    url.origin === root.origin &&
    (url.pathname === root.pathname || url.pathname.startsWith(path))
  )) ? root : undefined;
}

/**
 * Rebase URL from canonical sitemap root to requested base URL
 *
 * @param url - URL
 * @param root - Canonical sitemap root
 * @param base - Requested base URL
 *
 * @returns Rebased URL
 */
function rebase(url: URL, root: URL, base: URL): URL {
  const rootPath = root.pathname.endsWith("/")
    ? root.pathname
    : `${root.pathname}/`;
  const path = url.pathname === root.pathname
    ? ""
    : url.pathname.slice(rootPath.length);
  const target = new URL(base);
  if (!target.pathname.endsWith("/")) target.pathname += "/";
  return new URL(`${path}${url.search}${url.hash}`, target);
}

/**
 * Extract sitemap from document
 *
 * This function extracts the URLs and alternate links from the document, and
 * associates alternate links to the original URL as found in `loc`, allowing
 * the browser to navigate to the correct page when switching languages. The
 * format of the sitemap is expected to adhere to:
 *
 * ``` xml
 * <urlset>
 *   <url>
 *     <loc>...</loc>
 *     <xhtml:link rel="alternate" hreflang="en" href="..."/>
 *     <xhtml:link rel="alternate" hreflang="de" href="..."/>
 *     ...
 *   </url>
 *   ...
 * </urlset>
 * ```
 *
 * @param document - Document
 * @param base - Base URL
 *
 * @returns Sitemap
 */
function extract(document: Document, base: URL): Sitemap {
  const sitemap: Sitemap = new Map();
  const elements = getElements("url", document);
  const locations = elements.map((el) => (
    resolve(new URL(getElement("loc", el).textContent!), base)
  ));
  const root = getRoot(locations);

  for (let index = 0; index < elements.length; index++) {
    const el = elements[index];

    // Rebase canonical locations when the sitemap is served through an alias,
    // e.g. a `mike` symlink, so navigation remains within the requested path.
    const location = root
      ? rebase(locations[index], root, base)
      : locations[index];
    const links = [location];
    sitemap.set(`${links[0]}`, links);

    // Attach alternate links to current entry
    for (const link of getElements("[rel=alternate]", el)) {
      const href = link.getAttribute("href");
      if (href != null) links.push(resolve(new URL(href), base));
    }
  }

  // Return sitemap
  return sitemap;
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Fetch the sitemap for the given base URL
 *
 * If a network or parsing error occurs, we just default to an empty sitemap,
 * which means the caller should fall back to regular navigation.
 *
 * @param base - Base URL
 *
 * @returns Sitemap observable
 */
export function fetchSitemap(base: URL | string): Observable<Sitemap> {
  return requestXML(new URL("sitemap.xml", base)).pipe(
    map((document) => extract(document, new URL(base))),
    catchError(() => of(new Map())),
    shareReplay(1),
  );
}
