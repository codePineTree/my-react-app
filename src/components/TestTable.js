import React, { useState } from "react";

function TestTable() {
  const [data, setData] = useState([]);

  const handleSearch = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/test5");
      if (!response.ok) throw new Error("Network response was not ok");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("데이터를 가져오는 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <button onClick={handleSearch}>Search</button>
      <table
        border="1"
        style={{ borderCollapse: "collapse", marginTop: "10px", width: "50%" }}
      >
        <thead>
          <tr>
            <th>테스트번호</th>
            <th>테스트설명</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan="2" style={{ textAlign: "center" }}>
                데이터가 없습니다.
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index}>
                <td>{row.TESTDESCNO}</td>
                <td>{row.TESTDESC}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default TestTable;
