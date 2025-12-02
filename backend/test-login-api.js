const http = require("http");

const testLogin = async () => {
  try {
    const loginData = JSON.stringify({
      username: "1",
      password: "1"
    });

    console.log("测试登录API...");
    const response = await makeRequest("POST", "/api/auth/login", loginData);
    console.log("✅ 登录成功!");
    console.log("返回的用户信息:", response.user);
  } catch (error) {
    console.error("❌ 登录失败:", error.message);
  }
};

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 28964,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsedData.error || "Request failed"}`));
          }
        } catch (error) {
          reject(new Error(`Response parse error: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

testLogin();
