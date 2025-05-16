import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { Compiler, Stats } from "webpack"
import FileBundler from "file-bundler"
import htmlMinifier from "html-minifier-terser"
import { Options as htmlMinifierOptions } from "html-minifier-terser"
import sass from "sass"
import postcss from "postcss"
import autoprefixer from "autoprefixer"

export default class Htmlwp {
   private readonly name = "Htmlwp"
   private readonly fileDependencies = new Map<string, string[]>()
   private readonly cssFileNameHashes = new Map<string, string>()
   private readonly options
   private logger!: WebpackLogger
   private readonly htmlFileBundler
   private stats!: Stats
   private isProductionMode = false

   constructor(options: HtmlwpOptions) {
      this.options = options
      this.htmlFileBundler = new FileBundler({
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
         stats.compilation.fileDependencies.addAll(Array.from(this.fileDependencies.values()).flat())
         callback()
      })
   }

   private handleExternalAssets = async () => {

      try {

         const modifiedFile = this.getModifiedFile()

         if (modifiedFile) {

            for (const [mainFilePathName, filePathNames] of this.fileDependencies) {
               if (!filePathNames.includes(modifiedFile)) continue
               await this.hate(mainFilePathName)
            }

            return
         }

         for (const key in this.options.entry) {
            const entryObject = this.options.entry[key]
            if ("srcPath" in entryObject && entryObject.destPath) {
               await this.copyMoveFolderAsync(entryObject.srcPath, entryObject.destPath)
            }
         }

         await this.hate()
         
      } catch (error) {
         this.logger.error(error)
      }
   }

   private hate = async (mainFilePathName?: string) => {

      let globalEntryObject = this.options.entry["global"] as HtmlwpEntryObjectFB | undefined

      if (globalEntryObject && globalEntryObject.import) globalEntryObject = undefined

      let cleanedCssFiles = false

      loop1:for (const key in this.options.entry) {
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

         const dirname = path.dirname(this.resolvePath([this.getOutputPath(), filename]))

         await fs.rm(dirname,{recursive: true})
      } catch (o_o){}
   }

   private bundleHtml = async (entryObject: HtmlwpEntryObjectFB, globalEntryObject?: HtmlwpEntryObjectFB) => {

      const bundleResults = this.htmlFileBundler.bundle(entryObject.import!) as __bundleResults

      if (this.isProductionMode) await this.minify(bundleResults)

      if (globalEntryObject && Array.isArray(globalEntryObject.styles)) {
         this.injectLinkTags(bundleResults, globalEntryObject.styles)
      }

      if (Array.isArray(entryObject.styles)) {
         this.injectLinkTags(bundleResults, entryObject.styles)
      }

      if (globalEntryObject && Array.isArray(globalEntryObject?.jschunks)) {
         this.injectScriptTags(bundleResults, globalEntryObject.jschunks)
      }

      if (Array.isArray(entryObject.jschunks)) {
         this.injectScriptTags(bundleResults, entryObject.jschunks)
      }

      this.fileDependencies.set(entryObject.import!, bundleResults.filePathNames)

      await this.output(entryObject.filename!, bundleResults)
   }

   private injectLinkTags = (bundleResults: __bundleResults, styles: HtmlwpEntryObjectPathOptions[]) => {

      let tag = ""
      for (let i = 0; i < styles.length; i++) {
         const stylePathOptions = styles[i]
         const filename = ("/" + (this.cssFileNameHashes.get(stylePathOptions.import) || stylePathOptions.filename)).replace(/[\\/]+/g, "/")
         tag += `<link rel="stylesheet" href="${filename}">`
      }
      
      bundleResults.source = bundleResults.source.replace(/<\/head>/, tag + "</head>")
   }

   private injectScriptTags = (bundleResults: __bundleResults, jschunks: HtmlwpEntryObjectJsChunksOptions[]) => {

      const tagMap = new Map<string, string>()

      for (let i = 0; i < jschunks.length; i++) {
         const jschunk = jschunks[i]
         
         const chunk = this.stats.compilation.namedChunks.get(jschunk.name)

         if (!chunk) continue

         const filename = ("/" + [...chunk.files][0]).replace(/[\\/]+/g, "/")

         const attributes = Object.entries(jschunk.attributes || {}).map(a => `${a[0]}${typeof a[1] === "string" ? "="+"\""+a[1]+"\"" : ""}`).join(" ")

         tagMap.set(jschunk.inject || "body", `<script ${attributes} src="${filename}"></script>`.replace(/\s+/g, " "))
      }

      for (const [key, tag] of tagMap) {
         if (key === "head") {
            bundleResults.source = bundleResults.source.replace(/<\/head>/, tag + "</head>")
         } else {
            const lastIndexOfBody = bundleResults.source.lastIndexOf("</body>")

            if (lastIndexOfBody === -1) continue
            
            bundleResults.source = bundleResults.source.slice(0, lastIndexOfBody) + tag + bundleResults.source.slice(lastIndexOfBody)
         }
      }

      
   }

   private bundleCss = async (stylePathOptions: HtmlwpEntryObjectPathOptions) => {

      const sassResult = sass.compile(stylePathOptions.import, {
         style: this.isProductionMode ? "compressed" : undefined,
         alertColor: false
      })

      const bundleResults = { source: sassResult.css, filePathNames: [] } as __bundleResults
      
      bundleResults.filePathNames = sassResult.loadedUrls.map(url => this.resolvePath([url.pathname]))

      if (this.isProductionMode) {
         bundleResults.source = postcss([autoprefixer]).process(bundleResults.source, {
            from: undefined
         }).css
      }
      
      let filename = stylePathOptions.filename

      if (stylePathOptions.filename.includes("[contenthash]")) {
         filename = stylePathOptions.filename.replace(
            "[contenthash]",
            crypto.createHash("md5").update(bundleResults.source).digest("hex").slice(0, 24)
         )
         this.cssFileNameHashes.set(stylePathOptions.import, filename)
      }

      this.fileDependencies.set(stylePathOptions.import, bundleResults.filePathNames)
      
      await this.output(filename, bundleResults)
   }

   private resolvePath = (paths: string[]) => {
      paths.forEach((p, i) => paths[i] = p.split(/[\\|\/]+/).filter(v => v).join("/"))
      return path.resolve(...paths)
   }

   private copyMoveFolderAsync = async (srcPath: string, destPath: string) => {
      try {
         const outputPath = this.options.outputPath || this.stats.compilation.outputOptions.path || "dist"
                  
         await this.makeDirIfNotExists(this.resolvePath([outputPath, destPath]))

         const files = await fs.readdir(srcPath)

         await Promise.all(
            files.map(async (file) => {
               const srcFile = this.resolvePath([srcPath, file])
               const destFile = this.resolvePath([outputPath, destPath, file])

               const filePathNameStats = await fs.stat(srcFile)

               if (filePathNameStats.isDirectory()) {
                  await this.copyMoveFolderAsync(srcFile, destFile)
               } else {
                  if (file.endsWith(".json") && this.isProductionMode) {
                     const jsonData = await fs.readFile(srcFile, "utf8")
                     const compressedJsonData = JSON.stringify(JSON.parse(jsonData))
                     await fs.writeFile(destFile, compressedJsonData, "utf8")
                  } else {
                     await fs.copyFile(srcFile, destFile)
                  }
               }

            })
         )

      } catch (error) {
         this.logger.error(error)
      }
   }

   private getModifiedFile = () => {
      const modifiedFiles = this.stats.compilation.compiler.modifiedFiles
      if (!modifiedFiles) return null
      return [...modifiedFiles][0] || null
   }

   private minify = async (bundleResults: __bundleResults) => {

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

   private output = async (filePathName: string, bundleResults: __bundleResults) => {

      try {
         const outputPath = this.getOutputPath()

         filePathName = this.resolvePath([outputPath, filePathName])

         let directory = filePathName
         if (path.basename(filePathName)) {   
            directory = path.dirname(filePathName)
         }
      
         await this.makeDirIfNotExists(directory)

         await fs.writeFile(filePathName, bundleResults.source)

      } catch (e) {
         const error = e as Error
         this.logger.error(error)
      }
   }

   private getOutputPath = () => this.options.outputPath || this.stats.compilation.outputOptions.path || "dist"

   private fileExists = async (filePathName: string) => {
      try {
         await fs.access(filePathName)
         return true
      } catch (error) {
         const e = error as any
         if (e.code === "ENOENT") {
            return false
         }
         throw error
      }
   }

   private makeDirIfNotExists = async (directory: string) => {

      const fileExists = await this.fileExists(directory)

      if (fileExists) return
      
      await fs.mkdir(directory, { recursive: true })
   }

}

type HtmlwpEntryObjectPathOptions = {
   import: string
   filename: string
}

type HtmlwpEntryObjectJsChunksOptions = {
   name: string
   inject?: "body" | "head",
   attributes?: {[k: string]: any}
}

type HtmlwpEntryObjectCopyMove = {
   srcPath: string
   destPath: string
}

type HtmlwpEntryObjectFB = Partial<HtmlwpEntryObjectPathOptions> & {
   styles?: HtmlwpEntryObjectPathOptions[]
   jschunks?: HtmlwpEntryObjectJsChunksOptions[]
}

type HtmlwpEntryObject = {
   [k: string]: HtmlwpEntryObjectFB | HtmlwpEntryObjectCopyMove
}

type HtmlwpOptions = {

   entry: HtmlwpEntryObject

   outputPath?: string

   htmlMinifyOptions?: htmlMinifierOptions

   // cssMinifyOptions?: {[k: string]: any}

   htmlIncludePrefixName?: string

   htmlIncludeProperties?: {
      [k: string]: string
   }
}

type __bundleResults = {
   source: string
   filePathNames: string[]
}

interface WebpackLogger {
	getChildLogger: (arg0: string | (() => string)) => WebpackLogger;
	error(...args: any[]): void;
	warn(...args: any[]): void;
	info(...args: any[]): void;
	log(...args: any[]): void;
	debug(...args: any[]): void;
	assert(assertion: any, ...args: any[]): void;
	trace(): void;
	clear(): void;
	status(...args: any[]): void;
	group(...args: any[]): void;
	groupCollapsed(...args: any[]): void;
	groupEnd(...args: any[]): void;
	profile(label?: any): void;
	profileEnd(label?: any): void;
	time(label?: any): void;
	timeLog(label?: any): void;
	timeEnd(label?: any): void;
	timeAggregate(label?: any): void;
	timeAggregateEnd(label?: any): void;
}
