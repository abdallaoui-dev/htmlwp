import { Compiler } from "webpack"

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

   htmlMinifyOptions?: {[k: string]: any}

   // cssMinifyOptions?: {[k: string]: any}

   htmlIncludePrefixName?: string

   htmlIncludeProperties?: {
      [k: string]: string
   }
}


declare class Htmlwp {
   private options;
   constructor(options: HtmlwpOptions);
   apply(compiler: Compiler): void
}
export = Htmlwp
