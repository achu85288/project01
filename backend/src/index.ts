import { server } from "@/app";
import "dotenv/config";
import appConfig from "@/config";

const init = async (): Promise<void> => {
  server.on("error", (error) => {
    console.error("Server error:", error);
    throw error;
  });

  server.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running at port: http://localhost:${appConfig.port}`);
  });
};

init();
