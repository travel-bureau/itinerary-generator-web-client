import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const ErrorPage = () => {
  return (
    <section className="flex justify-center items-center h-5/6 my-48">
      <div className="flex flex-col md:flex-row items-center text-center">
        <div className="hero">
          <div className="hero-content text-center">
            <div className="max-w-md">
              <h1 className="text-5xl font-bold">Oops!</h1>
              <p className="py-6">
                This page does not exist or has been removed
              </p>
              <Button className="w-auto sm:w-auto">
                <ArrowRight className="mr-2 size-4" />
                <a href="/">Back to Home</a>
              </Button>
            </div>
          </div>
        </div>
        <div className="hero p-10">
          <div className="image-container">
            <img
              src="/assets/images/404.webp"
              alt="404 Error"
              className="max-w-xs md:max-w-md"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ErrorPage;
