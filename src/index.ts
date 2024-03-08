import App from "./server";

const port:number = parseInt(process.env.PORT ?? "7000")

App.listen(port);