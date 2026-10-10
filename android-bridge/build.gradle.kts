plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("androidx.room:room-common:2.6.1")
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.xerial:sqlite-jdbc:3.47.1.0")
}

tasks.test {
    useJUnitPlatform()
}
