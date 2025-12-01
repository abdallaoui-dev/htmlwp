const path = require("path")
const Htmlwp = require("htmlwp")
const webpack = require("webpack")

const joinPath = (mypath) => path.join(__dirname, mypath)

const isProdMode = false

const wconfig = {
   
   mode: isProdMode ? "production" : "development",
   watch: true,

   entry: {
      index: joinPath("src/js/index.js")
   },

   output: {
      path: joinPath("dist"),
      filename: isProdMode ? "js/s.[contenthash].js" : "js/[name].js",
      clean: true
   },

   plugins: [
      
      new Htmlwp({
         entry: {

            // global: {

            //    styles: [
            //       {
            //          import: joinPath("src/scss/global.scss"),
            //          filename: isProdMode ? "/css/[contenthash].css" : "/css/global.css"
            //       }
            //    ],

            //    jschunks: [
            //       {
            //          name: "lib",
            //          inject: "head"
            //       }
            //    ]

            // },

            index: {
               import: joinPath("src/html/index.html"),
               filename: "index.html",
               styles: [
                  {
                     import: joinPath("src/scss/index.scss"),
                     filename: isProdMode ? "css/[contenthash].css" : "/css/index.css"
                  }
               ],
               
               jschunks: [
                  {
                     name: "index",
                     attributes: {
                        id: "theId",
                     }
                  }
               ]
            }

         },

         // images: {
         //    srcPath: joinPath("src/images"),
         //    destPath: "/images"
         // },
         
         outputPath: joinPath("dist"),
         
         // htmlIncludePrefixName: "myapp", // myapp.include("/file.html")

         htmlIncludeProperties: {
            title: "Free Palestine",
            url: "https://webpack.js.org",
            domainName: "domain name",
            meta: "<meta>"
         }
      })
   ],

   resolve: {
      extensions: [".js"],
   }
}
// console.log("webpack")
// setTimeout(() => {
   
//    webpack(wconfig, () => {
//       console.log("hello")
//    })
   
// }, 1000)
module.exports = wconfig

