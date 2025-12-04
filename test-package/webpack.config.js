const path = require("path")
const Htmlwp = require("htmlwp")
const webpack = require("webpack")

const joinPath = (mypath) => path.join(__dirname, mypath)

const isProdMode = true

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

            global: {

               styles: [
                  {
                     import: joinPath("src/scss/global.scss"),
                     filename: isProdMode ? "/css/[contenthash].css" : "/css/global.css"
                  }
               ],

               // jschunks: [
               //    {
               //       name: "lib",
               //       inject: "head"
               //    }
               // ]

            },

            index: {
               import: joinPath("src/html/index.html"),
               filename: "index.html",

               injectCanonicalMetaTag: {
                  urlOrigin: "https://example.com",
                  forceTrailingSlash: false
               },

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
            },

            about: {
               import: joinPath("src/html/about.html"),
               filename: "about.html",

               injectCanonicalMetaTag: {
                  urlOrigin: "https://example.com",
                  forceTrailingSlash: false
               },

               styles: [
                  {
                     import: joinPath("src/scss/about.scss"),
                     filename: isProdMode ? "css/[contenthash].css" : "/css/about.css"
                  }
               ]
            },

            images: {
               srcPath: joinPath("src/images"),
               destPath: "/images"
            }

         },

         
         outputPath: joinPath("dist"),
         
         // htmlIncludePrefixName: "myapp", // myapp.include("/file.html")

         htmlIncludeProperties: {
            title: "Free Palestine",
            url: "https://webpack.js.org",
            domainName: "domain name",
            meta: "<meta>"
         },

         xmlsitemap: {
            urlOrigin: "https://example.com",
            lastmod: "current",
            exclude: ["/privacy"]
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

