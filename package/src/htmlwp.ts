import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import crypto from "node:crypto"
import { Compiler, Stats } from "webpack"
import htmlMinifier from "html-minifier-terser"
import { Options as htmlMinifierOptions } from "html-minifier-terser"
import sass from "sass"
import postcss from "postcss"
import autoprefixer from "autoprefixer"
import FileBundler from "./file-bundler"

export default class Htmlwp {
   private className = "Htmlwp"
   private readonly name = this.className
   private readonly watchedDependencies = new Map<string, string[]>()
   private readonly cssOutputPaths = new Map<string, string>()
   private readonly options
   private logger!: WebpackLogger
   private readonly includer
   private stats!: Stats
   private isProductionMode = false

   constructor(options: HtmlwpOptions) {
      this.options = options
      this.includer = new FileBundler({
         className: this.options.htmlIncludePrefixName || this.name,
         pattern: "include",
         includeProperties: this.options.htmlIncludeProperties
      })
   }

   public apply = (compiler: Compiler) => {
      this.logger = compiler.getInfrastructureLogger(this.name)

      compiler.hooks.done.tapAsync(this.name, async (stats: Stats, callback) => {
         this.stats = stats
         this.isProductionMode = this.stats.compilation.compiler.options.mode === "production"
         await this.handleExternalAssets()
         stats.compilation.fileDependencies.addAll(Array.from(this.watchedDependencies.values()).flat())
         callback()
      })
   }

   private handleExternalAssets = async () => {
      try {
         const modifiedFile = this.getFirstModifiedFile()
         if (modifiedFile) {
            for (const [mainFilePathName, filePathNames] of this.watchedDependencies) {
               if (!filePathNames.includes(modifiedFile)) continue
               await this.processEntries(mainFilePathName)
            }
            return
         }

         for (const key in this.options.entry) {
            const entryObject = this.options.entry[key]
            if ("srcPath" in entryObject && entryObject.destPath) {
               await this.copyAssets(entryObject.srcPath, entryObject.destPath)
            }
         }

         await this.processEntries()
      } catch (error) {
         this.logger.error(error)
      }
   }

   private processEntries = async (mainFilePathName?: string) => {
      // Global entry is for shared assets only — it must NOT have its own HTML file
      let globalEntryObject = this.options.entry["global"] as HtmlwpFileBundlerEntry | undefined
      if (globalEntryObject && globalEntryObject.import) globalEntryObject = undefined

      let cleanedCssFiles = false

      loop1: for (const key in this.options.entry) {
         const entryObject = this.options.entry[key]
         if ("srcPath" in entryObject) continue

         if (Array.isArray(entryObject.styles)) {
            for (let i = 0; i < entryObject.styles.length; i++) {
               const stylePathOptions = entryObject.styles[i]
               if (!cleanedCssFiles && this.stats.compilation.outputOptions.clean) {
                  await this.cleanCssFiles(stylePathOptions.filename)
                  cleanedCssFiles = true
               }
               if (!mainFilePathName || stylePathOptions.import === mainFilePathName) {
                  await this.bundleCss(stylePathOptions)
                  if (mainFilePathName) break loop1
               }
            }
         }

         if (!entryObject.import || !entryObject.filename) continue
         if (!mainFilePathName || mainFilePathName === entryObject.import) {
            await this.bundleHtml(entryObject, globalEntryObject)
            if (mainFilePathName) break loop1
         }
      }
   }

   private cleanCssFiles = async (filename: string) => {
      try {
         const dirname = path.dirname(path.join(this.getOutputPath(), filename))
         await fs.rm(dirname, { recursive: true })
      } catch (O_o) {}
   }

   private bundleHtml = async (entryObject: HtmlwpFileBundlerEntry, globalEntryObject?: HtmlwpFileBundlerEntry) => {
      const bundleResults = this.includer.bundle(entryObject.import!)

      if (this.isProductionMode) await this.minify(bundleResults)

      if (globalEntryObject && Array.isArray(globalEntryObject.styles)) {
         this.injectLinkTags(bundleResults, globalEntryObject.styles)
      }
      if (Array.isArray(entryObject.styles)) {
         this.injectLinkTags(bundleResults, entryObject.styles)
      }
      if (globalEntryObject && Array.isArray(globalEntryObject.jschunks)) {
         this.injectScriptTags(bundleResults, globalEntryObject.jschunks)
      }
      if (Array.isArray(entryObject.jschunks)) {
         this.injectScriptTags(bundleResults, entryObject.jschunks)
      }

      this.watchedDependencies.set(entryObject.import!, bundleResults.filePathNames)
      await this.output(entryObject.filename!, bundleResults)
   }

   private injectLinkTags = (bundleResults: HtmlwpBundleResult, styles: HtmlwpStylesheetEntry[]) => {
      let tags = ""
      for (const style of styles) {
         const filename = ("/" + (this.cssOutputPaths.get(style.import) || style.filename)).replace(/[\\/]+/g, "/")
         tags += `<link rel="stylesheet" href="${filename}">`
      }
      bundleResults.source = bundleResults.source.replace(/<\/head>/, tags + "</head>")
   }

   private injectScriptTags = (bundleResults: HtmlwpBundleResult, jschunks: HtmlwpScriptChunkEntry[]) => {
      const tagMap = new Map<string, string>()
      for (const jschunk of jschunks) {
         const chunk = this.stats.compilation.namedChunks.get(jschunk.name)
         if (!chunk) continue

         const filename = ("/" + [...chunk.files][0]).replace(/[\\/]+/g, "/")
         const attributes = Object.entries(jschunk.attributes || {})
            .map(([k, v]) => typeof v === "string" ? `${k}="${v}"` : k)
            .join(" ")
         const tag = `<script ${attributes} src="${filename}"></script>`.replace(/\s+/g, " ")
         const key = jschunk.inject || "body"
         tagMap.set(key, (tagMap.get(key) || "") + tag)
      }

      for (const [key, tags] of tagMap) {
         if (key === "head") {
            bundleResults.source = bundleResults.source.replace(/<\/head>/, tags + "</head>")
         } else {
            const lastIndexOfBody = bundleResults.source.lastIndexOf("</body>")
            if (lastIndexOfBody === -1) continue
            bundleResults.source =
               bundleResults.source.slice(0, lastIndexOfBody) +
               tags +
               bundleResults.source.slice(lastIndexOfBody)
         }
      }
   }

   private bundleCss = async (stylePathOptions: HtmlwpStylesheetEntry) => {
      try {
         const sassResult = sass.compile(stylePathOptions.import, {
            style: this.isProductionMode ? "compressed" : undefined,
            alertColor: false
         })
         
         const bundleResults: HtmlwpBundleResult = {
            source: sassResult.css,
            filePathNames: sassResult.loadedUrls.map(u => url.fileURLToPath(u.href))
         }

         if (this.isProductionMode) {
            bundleResults.source = postcss([autoprefixer]).process(bundleResults.source, { from: undefined }).css
         }
   
         let filename = stylePathOptions.filename
         if (filename.includes("[contenthash]")) {
            const hash = crypto.createHash("md5").update(bundleResults.source).digest("hex").slice(0, 24)
            filename = filename.replace("[contenthash]", hash)
            this.cssOutputPaths.set(stylePathOptions.import, filename)
         }
   
         this.watchedDependencies.set(stylePathOptions.import, bundleResults.filePathNames)

         await this.output(filename, bundleResults)
         
      } catch (error) {
         this.logger.error(`${this.className}.bundleCss: `, error)
      }
   }

   private copyAssets = async (srcPath: string, destPath: string) => {
      try {
         const outputPath = this.getOutputPath()
         const dest = path.join(outputPath, destPath)
         await this.ensureDirExists(dest)

         const files = await fs.readdir(srcPath)
         await Promise.all(files.map(async (file) => {
            const srcFile = path.join(srcPath, file)
            const destFile = path.join(dest, file)
            const stat = await fs.stat(srcFile)

            if (stat.isDirectory()) {
               await this.copyAssets(srcFile, destFile)
            } else {
               if (file.endsWith(".json") && this.isProductionMode) {
                  const data = JSON.parse(await fs.readFile(srcFile, "utf8"))
                  await fs.writeFile(destFile, JSON.stringify(data), "utf8")
               } else {
                  await fs.copyFile(srcFile, destFile)
               }
            }
         }))
      } catch (error) {
         this.logger.error(error)
      }
   }

   private getFirstModifiedFile = () => {
      const modifiedFiles = this.stats.compilation.compiler.modifiedFiles
      return modifiedFiles ? [...modifiedFiles][0] || null : null
   }

   private minify = async (bundleResults: HtmlwpBundleResult) => {
      const options = this.options.htmlMinifyOptions || {
         removeComments: true,
         removeScriptTypeAttributes: true,
         removeStyleLinkTypeAttributes: true,
         removeRedundantAttributes: true,
         collapseWhitespace: true,
         keepClosingSlash: true,
         useShortDoctype: true,
         minifyCSS: true,
         minifyJS: true
      }
      bundleResults.source = await htmlMinifier.minify(bundleResults.source, options)
   }

   private output = async (filePathName: string, bundleResults: HtmlwpBundleResult) => {
      try {
         const outputPath = this.getOutputPath()
         const fullOutputPath = path.join(outputPath, filePathName)
         const dir = path.dirname(fullOutputPath)
         await this.ensureDirExists(dir)
         await fs.writeFile(fullOutputPath, bundleResults.source)
      } catch (e) {
         this.logger.error(e as Error)
      }
   }

   private getOutputPath = () => this.options.outputPath || this.stats.compilation.outputOptions.path || "dist"

   private fileExists = async (filePathName: string) => {
      try {
         await fs.access(filePathName)
         return true
      } catch (error: any) {
         if (error.code === "ENOENT") return false
         throw error
      }
   }

   private ensureDirExists = async (directory: string) => {
      const fileExists = await this.fileExists(directory)
      if (!fileExists) {
         await fs.mkdir(directory, { recursive: true })
      }
   }
}

// ─── Types ───────────────────────────────────────────────────────

type HtmlwpStylesheetEntry = {
   import: string
   filename: string
}

type HtmlwpScriptChunkEntry = {
   name: string
   inject?: "body" | "head"
   attributes?: { [k: string]: any }
}

type HtmlwpAssetDirEntry = {
   srcPath: string
   destPath: string
}

type HtmlwpFileBundlerEntry = Partial<HtmlwpStylesheetEntry> & {
   styles?: HtmlwpStylesheetEntry[]
   jschunks?: HtmlwpScriptChunkEntry[]
}

type HtmlwpEntryObject = {
   [k: string]: HtmlwpFileBundlerEntry | HtmlwpAssetDirEntry
}

type HtmlwpOptions = {
   entry: HtmlwpEntryObject
   outputPath?: string
   htmlMinifyOptions?: htmlMinifierOptions
   htmlIncludePrefixName?: string
   htmlIncludeProperties?: { [k: string]: string }
}

type HtmlwpBundleResult = {
   source: string
   filePathNames: string[]
}

interface WebpackLogger {
   error(...args: any[]): void
   warn(...args: any[]): void
   info(...args: any[]): void
   log(...args: any[]): void
   debug(...args: any[]): void
}