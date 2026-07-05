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

import escapeHtml from "escape-html";

import {
  Observable,
  catchError,
  firstValueFrom,
  map,
  of,
  shareReplay,
} from "rxjs";

import { watchScript } from "~/browser";

import { Component } from "../../_";

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Pyodide block
 */
export interface Pyodide {}

/* ------------------------------------------------------------------------- */

/**
 * Canonical block elements
 */
interface Elements {
  root: HTMLElement;
  editor: HTMLElement;
  output: HTMLElement;
  run: HTMLElement;
  clear: HTMLElement;
  source: string;
  session: string;
  install: string[];
}

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

/**
 * Ace script observable
 */
let editor$: Observable<void>;

/**
 * Pyodide runtime observable
 */
let pyodide$: Observable<Promise<PyodideInterface | null>>;

/**
 * Shared sessions
 */
const sessions: Record<string, unknown> = {};

/**
 * Ace theme guard
 */
let themeRegistered = false;

/* ----------------------------------------------------------------------------
 * Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Fetch a script if not already present
 *
 * @param src - Script URL
 * @param predicate - Load predicate
 *
 * @returns Script observable
 */
function fetchScript(src: string, predicate: () => boolean): Observable<void> {
  return predicate()
    ? watchScript(src).pipe(
        catchError(() => of(undefined)),
        map(() => undefined),
      )
    : of(undefined);
}

/**
 * Parse a package list
 *
 * @param value - Package value
 *
 * @returns Package list
 */
function parsePackages(value: string | undefined): string[] {
  if (!value) return [];

  // Parse JSON array if the value is a valid JSON array
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed.filter(
          (item): item is string => typeof item === "string",
        );
    } catch {}
  }

  // Fallback to splitting the value by commas or whitespace
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Extract the configured session name from the canonical scaffold
 *
 * @param el - Pyodide root element
 *
 * @returns Session name
 */
function getSessionName(el: HTMLElement): string {
  const label = el.querySelector(".pyodide-editor-bar .pyodide-bar-item");
  const text = label?.textContent ?? "";
  const match = text.match(/session:\s*([^)]+)\)?/i);
  return match?.[1]?.trim() || "default";
}

/**
 * Extract the canonical scaffold elements
 *
 * @param el - Pyodide root element
 *
 * @returns Canonical elements
 */
function getElements(el: HTMLElement): Elements {
  const editor = el.querySelector<HTMLElement>("[id$='--editor']");
  const run = el.querySelector<HTMLElement>("[id$='--run']");
  const clear = el.querySelector<HTMLElement>("[id$='--clear']");
  const output = el.querySelector<HTMLElement>("[id$='--output']");

  // Validate scaffold
  if (!editor || !run || !clear || !output)
    throw new Error("Invalid Pyodide structure");

  // Return canonical elements
  return {
    root: el,
    editor,
    output,
    run,
    clear,
    source: editor.textContent?.trimEnd() ?? "",
    session: getSessionName(el),
    install: parsePackages(el.dataset.install),
  };
}

/**
 * Get session globals
 *
 * @param name - Session name
 * @param pyodide - Pyodide instance
 *
 * @returns Session globals
 */
function getSession(name: string, pyodide: PyodideInterface): unknown {
  if (!(name in sessions)) sessions[name] = pyodide.globals.get("dict")();
  return sessions[name];
}

/**
 * Write output
 *
 * @param element - Output element
 * @param string - Output
 */
function writeOutput(element: HTMLElement, string: string): void {
  element.innerHTML = escapeHtml(string);
}

/**
 * Clear output
 *
 * @param element - Output element
 */
function clearOutput(element: HTMLElement): void {
  element.innerHTML = "";
}

/**
 * Escape output like the original script
 *
 * @param string - Raw output
 *
 * @returns Escaped output
 */
function escapeOutput(string: string): string {
  return new Option(string).innerHTML;
}

/**
 * Wait for the next animation frame
 *
 * @returns Frame promise
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Evaluate Python
 *
 * @param pyodide - Pyodide instance
 * @param editor - Ace editor
 * @param output - Output element
 * @param session - Session name
 */
async function evaluatePython(
  pyodide: PyodideInterface,
  editor: AceEditor,
  output: HTMLElement,
  session: string,
): Promise<void> {
  const lines: string[] = [];

  pyodide.setStdout({
    batched(string: any) {
      lines.push(string);
      writeOutput(output, `${lines.join("\n")}\n`);
    },
  });

  try {
    const result = await pyodide.runPythonAsync(editor.getValue(), {
      globals: getSession(session, pyodide),
    });
    if (typeof result !== "undefined" && result !== null) {
      lines.push(String(result));
      writeOutput(output, `${lines.join("\n")}\n`);
    }
  } catch (error) {
    lines.push(escapeOutput(String(error)));
    writeOutput(output, `${lines.join("\n")}\n`);
  }
}

/**
 * Initialize Pyodide
 *
 * @returns Pyodide observable
 */
function initPyodide(): Observable<Promise<PyodideInterface | null>> {
  pyodide$ ||= fetchScript(
    "https://unpkg.com/pyodide@314.0.2/pyodide.js",
    () => typeof loadPyodide === "undefined" || loadPyodide instanceof Element,
  ).pipe(
    map(async () => {
      try {
        const pyodide = await loadPyodide({
          indexURL: "https://unpkg.com/pyodide@314.0.2/",
        });
        await pyodide.loadPackage("micropip");
        return pyodide;
      } catch {
        return null;
      }
    }),
    shareReplay(1),
  );

  return pyodide$;
}

/**
 * Register the custom Ace theme
 */
function registerTheme(): void {
  if (themeRegistered) return;

  // Register the custom Ace theme
  ace.define(
    "ace/theme/zensical",
    ["require", "exports", "module", "ace/lib/dom"],
    (_require: any, exports: any) => {
      exports.isDark = false;
      exports.cssClass = "ace-zensical";
      exports.cssText = "";
    },
  );
  themeRegistered = true;
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Mount Pyodide exec block
 *
 * @param el - Pyodide root element
 *
 * @returns Component observable
 */
export function mountPyodide(el: HTMLElement): Observable<Component<Pyodide>> {
  editor$ ||= fetchScript(
    "https://unpkg.com/ace-builds@1.44.0/src-noconflict/ace.js",
    () => typeof ace === "undefined" || ace instanceof Element,
  ).pipe(shareReplay(1));

  // Return observable
  return new Observable<Component<Pyodide>>((observer) => {
    let active = true;
    let editor: AceEditor | undefined;
    let runtime$: Promise<PyodideInterface | null> | undefined;

    // Extract canonical elements
    const elements = getElements(el);
    elements.root.setAttribute("data-md-exec-state", "ready");

    // Event handlers
    const onClear = (): void => clearOutput(elements.output);
    const ensurePyodide = async (): Promise<PyodideInterface | null> => {
      runtime$ ||= (async () => {
        elements.root.setAttribute("data-md-exec-state", "loading");
        writeOutput(elements.output, "Initializing...");
        await nextFrame();
        if (!active) return null;

        // Initialize Pyodide
        const pyodide = await firstValueFrom(initPyodide()).then(
          (promise) => promise,
        );
        if (!active || !pyodide) return null;

        // Install packages if specified
        if (elements.install.length > 0) {
          try {
            const micropip = pyodide.pyimport("micropip");
            for (const pkg of elements.install) await micropip.install(pkg);
          } catch (error) {
            clearOutput(elements.output);
            writeOutput(
              elements.output,
              `Could not install one or more packages: ${elements.install.join(", ")}\n${String(error)}`,
            );
            elements.root.setAttribute("data-md-exec-state", "error");
            return null;
          }
        }
        if (!active) return null;

        // Clear output and set state to ready
        clearOutput(elements.output);
        elements.root.setAttribute("data-md-exec-state", "ready");
        return pyodide;
      })();
      return runtime$;
    };

    // Event handlers
    const onRun = (): void => {
      void (async () => {
        const pyodide = await ensurePyodide();
        if (!active || !pyodide || !editor) return;
        void evaluatePython(pyodide, editor, elements.output, elements.session);
      })();
    };
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key.toLowerCase() === "enter") {
        event.preventDefault();
        elements.run.click();
      }
    };

    // Attach event listeners
    elements.run.addEventListener("click", onRun);
    elements.clear.addEventListener("click", onClear);
    elements.root.addEventListener("keydown", onKeydown);
    void (async () => {
      await firstValueFrom(editor$);
      if (!active) return;

      // Register the custom Ace theme
      registerTheme();
      elements.editor.textContent = "";
      editor = ace.edit(elements.editor);
      editor.setTheme("ace/theme/zensical");
      editor.session.setMode("ace/mode/python");
      editor.setOption("fontFamily", "var(--md-code-font)");
      editor.setOption("minLines", 0);
      editor.setOption("maxLines", Infinity);
      editor.session.setValue(elements.source);
      editor.gotoLine(1, 0, false);
      editor.clearSelection();
      editor.resize();
      editor.renderer.updateFull();
    })();

    // Emit component reference
    observer.next({ ref: elements.root });
    return () => {
      active = false;
      elements.run.removeEventListener("click", onRun);
      elements.clear.removeEventListener("click", onClear);
      elements.root.removeEventListener("keydown", onKeydown);
      editor?.destroy();
      elements.root.removeAttribute("data-md-exec-state");
    };
  });
}
