import { Compiler } from "webpack"


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
   htmlMinifyOptions?: any
   htmlIncludePrefixName?: string
   htmlIncludeProperties?: { [k: string]: string }
}


declare class Htmlwp {
   private options;
   constructor(options: HtmlwpOptions);
   apply(compiler: Compiler): void
}

export = Htmlwp
