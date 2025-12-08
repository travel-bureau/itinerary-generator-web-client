#!/bin/bash

# Execute Git commands
echo "Adding changes to staging area..."
git add .

echo "Checking the current status of the repository..."
git status

# Prompt user for the commit message
echo "Enter your commit message:"
read -e commit_message

echo "Committing changes with the provided message..."
git commit -m "$commit_message"

echo "Switching to the branch: master"
git checkout master

echo "Pushing changes to the remote branch: master"
git push -u origin master

echo "All done!"
