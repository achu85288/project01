import { server } from "@/app";
import "dotenv/config";

const init = async (): Promise<void> => {
  server.on("error", (error) => {
    console.error("Server error:", error);
    throw error;
  });

  server.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running at port: ${process.env.PORT || 8000}`);
  });
};

init();
