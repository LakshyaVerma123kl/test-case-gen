import React from "react";
import { Github, LogOut, Zap } from "lucide-react";
import Button from "./Button";

const Header = ({ user, onLogout }) => {
  return (
    <header className="bg-white shadow-soft border-b border-secondary-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-lg">
              <Zap className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-secondary-900">
                Test Case Generator
              </h1>
              <p className="text-xs text-secondary-500">Powered by Workik AI</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img
                  src={user.avatar_url}
                  alt={user.name || user.login}
                  className="w-8 h-8 rounded-full"
                />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-secondary-900">
                    {user.name || user.login}
                  </p>
                  <p className="text-xs text-secondary-500 flex items-center">
                    <Github className="w-3 h-3 mr-1" />
                    {user.login}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-secondary-600 hover:text-error-600"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
