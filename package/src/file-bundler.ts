import fs from "fs"
import path from "path"

type FileBundlerOptions = {
  className?: string
  pattern?: "include" | "@?import"
  includeProperties?: {
    [k: string]: string
  }
}

export default class FileBundler {
  private name = "FileBundler"
  private initialFilePathName = ""
  private previousFilePathName = ""
  private filePathNames = new Set<string>()
  private fileCache = new Map<string, string>()
  public readonly includePattern
  public readonly importPattern
  private readonly pattern
  private options

  constructor(options: FileBundlerOptions) {
    this.options = options
    this.validateOptions()
    this.name = (this.options.className || this.name).replace(/[^\w]/g, "")
    this.includePattern = new RegExp(
      `(${this.name}\\.include)\\s*((\\.\\w+)|(\\(\\s*\"([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\"\\s*\\))|(\\(\\s*\'([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\'\\s*\\))|(\\(\\s*\`([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\`\\s*\\)))(\\s*;)?`,
      'gi'
    )
    this.importPattern = new RegExp(
      `(@?import)\\s*((\"([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\")|(\'([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\')|(\`([\\\\\\/\\w\\-\\.\\:\\~\\s]+)\`))(\\s*;)?`,
      'gi'
    )
    this.pattern = this.options.pattern === "@?import" ? this.importPattern : this.includePattern
  }

  private validateOptions() {
    this.options.className = typeof this.options.className === "string" ? this.options.className : ""
    if (!this.isObjectLiteral(this.options.includeProperties)) {
      this.options.includeProperties = {}
    }
    for (const key in this.options.includeProperties) {
      if (typeof this.options.includeProperties[key] !== "string") {
        delete this.options.includeProperties[key]
      }
    }
  }

  private isObjectLiteral(obj: any) {
    return typeof obj === "object" && obj !== null && String(obj) === "[object Object]"
  }

  private readFileSyncCached(filePath: string): string {
    if (!this.fileCache.has(filePath)) {
      this.fileCache.set(filePath, fs.readFileSync(filePath, "utf-8"))
    }
    return this.fileCache.get(filePath)!
  }

  private replace(filePathName: string) {
    try {
      if (typeof filePathName !== "string") throw new Error("Invalid filePathName")

      let source = ""
      filePathName = path.resolve(
        path.dirname(this.previousFilePathName || this.initialFilePathName),
        filePathName.replace(/^[\\\/]*/g, "")
      )

      if (this.initialFilePathName !== filePathName) {
        source = this.readFileSyncCached(filePathName)
        this.filePathNames.add(filePathName)
      }
      if (!this.initialFilePathName) this.initialFilePathName = filePathName

      source = source.replace(this.pattern, (match, g1, name: string) => {
        if (!name) throw new Error("Regex capture failed")

        if (name.startsWith(".")) {
          name = name.replace(/\./g, "")
          return this.getPropertyValue(name) || `${this.name} Exception:\n${"*".repeat(10)} ERROR: Property '${name}' not found in includeProperties ${"*".repeat(10)}`
        } else if (name.match(/^["'`(]/)) {
          let subFilePathName = name.replace(/['"`()]+/g, "")
          const initialExt = path.extname(this.initialFilePathName)
          const subExt = path.extname(subFilePathName)
          if (!subExt) {
            subFilePathName += initialExt
          }
          this.previousFilePathName = filePathName
          return this.replace(subFilePathName).source
        } else {
          return match // fallback: leave unchanged if unrecognized
        }
      })

      return { source, filePathNames: [...this.filePathNames] }
    } catch (e) {
      const error = e as Error
      this.logError(error)
      const message = error?.message
        ? `${this.name} Exception:\n${"*".repeat(10)} ${error.message} ${"*".repeat(10)}`
        : `${this.name} ERROR: check console`
      return { source: message, filePathNames: [] }
    }
  }

  private getPropertyValue(name: string) {
    if (!this.isObjectLiteral(this.options.includeProperties)) return null
    return this.options.includeProperties![name] || null
  }

  public bundle(filePathName: string) {
    return this.getFinalResults(filePathName)
  }

  public bundleAsync(filePathName: string) {
    return Promise.resolve(this.getFinalResults(filePathName))
  }

  private getFinalResults(filePathName: string) {
    const results = this.replace(filePathName)
    this.initialFilePathName = ""
    this.previousFilePathName = ""
    this.filePathNames.clear()
    this.fileCache.clear() // 👈 crucial for multi-page builds
    return results
  }

  public logError(error: Error | string) {
     console.log("\x1b[31m\x1b[1m", `${this.name} Exception:\n`, String(error), "\x1b[0m")
  }
}