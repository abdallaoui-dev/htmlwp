import { Compiler } from "webpack"



type HtmlwpXmlSitemapEntry = {
   /** Base URL (https://example.com) */
   urlOrigin: string

   /** "current" or custom date string */
   lastmod?: "current" | string

   /** Pages to exclude (/privacy-policy) */
   exclude?: string[]

   /** Manual paths (/palestinian-food-recipes) - (if set, exclude is ignored) */
   include?: string[]
}

type HtmlwpCanonicalMetaTagEntry = {
   urlOrigin: string
   forceTrailingSlash?: boolean
}

type HtmlwpIOEntry = {
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

type HtmlwpFileBundlerEntry = Partial<HtmlwpIOEntry> & {
   styles?: HtmlwpIOEntry[]
   jschunks?: HtmlwpScriptChunkEntry[]
   injectCanonicalMetaTag?: HtmlwpCanonicalMetaTagEntry
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
   xmlsitemap?: HtmlwpXmlSitemapEntry
}


declare class Htmlwp {
   private options;
   constructor(options: HtmlwpOptions);
   apply(compiler: Compiler): void
}

export = Htmlwp
