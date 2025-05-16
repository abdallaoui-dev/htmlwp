import path from "path"
import Htmlwp from "htmlwp"
import { Configuration, webpack } from "webpack"

const joinPath = (mypath: string) => path.join(__dirname, mypath)

const wconfig: Configuration = {
   
   mode: "development",
   watch: false,

   entry: {
      lib: {
         import: joinPath("src/js/lib.js"),
         filename: "js/lib.js",
         library: {
            name: "lib",
            type: "var"
         }
      },
      index: joinPath("src/js/index.js"),
      about: joinPath("src/js/about.js"),
   },

   output: {
      path: joinPath("dist"),
      // filename: "js/s.[contenthash].js",
      filename: "js/[name].js",
      clean: true
   },

   plugins: [
      
      new Htmlwp({

         entry: {
            global: {
               styles: [
                  {
                     import: joinPath("src/scss/global.scss"),
                     // filename: "css/[contenthash].css"
                     filename: "/css/global.css"
                  }
               ],

               jschunks: [
                  {
                     name: "lib",
                     inject: "head"
                  }
               ]
            },

            index: {
               import: joinPath("src/html/index.html"),
               filename: "index.html",
               styles: [
                  {
                     import: joinPath("src/scss/index/lib.scss"),
                     // filename: "css/[contenthash].css"
                     filename: "/css/index-lib.css"
                  },
                  {
                     import: joinPath("src/scss/index/app.scss"),
                     // filename: "css/[contenthash].css"
                     filename: "/css/index.css"
                  },
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
               styles: [
                  {
                     import: joinPath("src/scss/about/lib.scss"),
                     // filename: "css/[contenthash].css"
                     filename: "/css/about-lib.css"
                  },
                  {
                     import: joinPath("src/scss/about/app.scss"),
                     // filename: "css/[contenthash].css"
                     filename: "/css/about.css"
                  },
               ],
               
               jschunks: [
                  {
                     name: "about"
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
            title: "my website title",
            domainName: "domain name",
            meta: "<meta>",
            headScript: "<script></script>",
            bodyScript: "<script></script>"
         }
      })
   ],

   resolve: {
      extensions: [".js"],
   }
}
webpack(wconfig, () => {
   // console.log("hello")
})

// export default wconfig

