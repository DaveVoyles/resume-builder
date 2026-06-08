"use strict";

const https = require("https");

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": "resume-builder-cli",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API ${response.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Invalid GitHub API JSON: ${error.message}`));
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("GitHub API request timed out"));
    });
  });
}

async function fetchGithubMetadata(username) {
  const safeUsername = String(username || "").trim();
  if (!safeUsername) throw new Error("Missing GitHub username");
  const encoded = encodeURIComponent(safeUsername);
  const [user, repos] = await Promise.all([
    getJson(`https://api.github.com/users/${encoded}`),
    getJson(`https://api.github.com/users/${encoded}/repos?per_page=100&sort=updated`),
  ]);
  return {
    username: safeUsername,
    profile: {
      login: user.login,
      name: user.name,
      company: user.company,
      blog: user.blog,
      location: user.location,
      bio: user.bio,
      public_repos: user.public_repos,
      followers: user.followers,
      html_url: user.html_url,
    },
    repos: repos.map((repo) => ({
      name: repo.name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      topics: repo.topics || [],
    })),
  };
}

module.exports = { fetchGithubMetadata };
