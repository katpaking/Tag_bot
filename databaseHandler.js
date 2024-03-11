

const mysql = require('mysql');

const connection = mysql.createConnection({
    host: '106.243.92.221',
    user: 'root',
    password: '1234',
    database: 'news_final',
    port: '3306',
});

const executeQuery = (sql, values, callback) => {
    connection.query(sql, values, (error, results) => {
        if (error) {
            console.error('Query execution error:', error);
            return callback(error, null);
        }
        callback(null, results);
    });
};

const closeConnection = () => {
    connection.end((error) => {
        if (error) {
            console.error('Error closing MySQL connection:', error);
        }
        console.log('MySQL connection closed');
    });
};





module.exports = {
    executeQuery,
    closeConnection,
    // saveArticle,
};
