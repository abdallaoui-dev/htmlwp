import path from "path"
import { Configuration } from "webpack"
import nodeExternals from "webpack-node-externals"

const joinPath = (mypath: string) => path.join(__dirname, mypath)

const wconfig: Configuration = {
   
   mode: "production",
   watch: false,
   target: ["node", "es5"],
   externalsPresets: { node: true },
   externals: [nodeExternals()],

   entry: joinPath("src/htmlwp.ts"),

   output: {
      path: joinPath("../out-package"),
      filename: "index.js",
      library: {
         type: "umd",
         export: "default"
      }
   },

   module: {
      rules: [
         {
            test: /\.ts$/,
            exclude: /node_modules/,
            use: {
               loader: "ts-loader"
            }
         },

      ]

   },

   resolve: {
      extensions: [".ts"],

   }
}

export default wconfig

